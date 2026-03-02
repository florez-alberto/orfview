import React, { useEffect, useState, useRef, useMemo } from 'react';
import { settingsManager } from '../../lib/settings/settingsManager';

interface CodeEditorProps {
    content: string;
    language?: string; // 'json' | 'text'
    onChange?: (newContent: string) => void;
    onSave?: () => void;
    style?: React.CSSProperties;
}

export function CodeEditor({ content, language = 'text', onChange, onSave, style }: CodeEditorProps) {
    const settings = settingsManager.getAll();
    const fontSize = settings['editor.fontSize'] || 13;
    const fontFamily = settings['editor.fontFamily'] || 'Menlo, Monaco, "Courier New", monospace';
    const wordWrap = settings['editor.wordWrap'] || 'off'; // 'off' | 'on'

    const [value, setValue] = useState(content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    // History management
    const historyRef = useRef<{ past: string[], future: string[] }>({ past: [], future: [] });
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (content !== value) {
            setValue(content);
        }
    }, [content]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        // Logic to group typing events into history
        if (!typingTimeoutRef.current) {
            historyRef.current.past.push(value);
            historyRef.current.future = [];
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null;
        }, 1000);

        setValue(newValue);
        if (onChange) {
            onChange(newValue);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (preRef.current) {
            preRef.current.scrollTop = e.currentTarget.scrollTop;
            preRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Tab support
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newValue = value.substring(0, start) + '    ' + value.substring(end);
            setValue(newValue);
            if (onChange) onChange(newValue);
            // Move cursor
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                }
            }, 0);
            return;
        }

        // Undo: Ctrl+Z or Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (historyRef.current.past.length > 0) {
                const previous = historyRef.current.past.pop();
                if (previous !== undefined) {
                    historyRef.current.future.push(value);
                    setValue(previous);
                    if (onChange) onChange(previous);
                }
            }
        }

        // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Cmd+Y
        if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
            ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
            e.preventDefault();
            if (historyRef.current.future.length > 0) {
                const next = historyRef.current.future.pop();
                if (next !== undefined) {
                    historyRef.current.past.push(value);
                    setValue(next);
                    if (onChange) onChange(next);
                }
            }
        }

        // Save: Ctrl+S or Cmd+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (onSave) onSave();
        }
    }

    // Syntax Highlighting for JSON
    const highlightedContent = useMemo(() => {
        if (language !== 'json') return value;
        return highlightJSON(value);
    }, [value, language]);

    const commonStyles: React.CSSProperties = {
        fontFamily: fontFamily,
        fontSize: typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
        lineHeight: '1.5',
        whiteSpace: wordWrap === 'on' ? 'pre-wrap' : 'pre', // Handle word wrap
        wordWrap: wordWrap === 'on' ? 'break-word' : 'normal',
        margin: 0,
        padding: '20px',
        border: 'none',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box'
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
            {/* Highlight Layer */}
            <pre
                ref={preRef}
                aria-hidden="true"
                style={{
                    ...commonStyles,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    color: '#d4d4d4',
                    zIndex: 1,
                    scrollbarWidth: 'none',
                }}
            >
                <code dangerouslySetInnerHTML={{ __html: highlightedContent + '<br/>' }} />
            </pre>

            {/* Input Layer */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                style={{
                    ...commonStyles,
                    ...style,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    background: 'transparent',
                    color: 'transparent', // Hide text
                    caretColor: '#aeafad', // Visible cursor
                    resize: 'none',
                    outline: 'none',
                    zIndex: 2
                }}
                spellCheck={false}
                autoCapitalize='off'
                autoComplete='off'
                autoCorrect='off'
            />
        </div>
    );
}

// Simple JSON + Comment Highlighter
function highlightJSON(code: string): string {
    const escape = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tokenRegex = /(\/\/.*)|(\/\*[\s\S]*?\*\/)|("(?:[^\\"]|\\.)*")\s*(:?)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],:])/g;

    let match;
    let lastIndex = 0;
    let html = '';

    // Reset regex state just in case
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(code)) !== null) {
        // Plain text between tokens
        if (match.index > lastIndex) {
            html += escape(code.substring(lastIndex, match.index));
        }

        const [fullMatch, lineComment, blockComment, string, colon, number, boolean, symbol] = match;

        if (lineComment) {
            html += `<span style="color: #6a9955;">${escape(lineComment)}</span>`;
        } else if (blockComment) {
            html += `<span style="color: #6a9955;">${escape(blockComment)}</span>`;
        } else if (string) {
            if (colon) {
                html += `<span style="color: #9cdcfe;">${escape(string)}</span>`;
                const afterString = fullMatch.substring(string.length);
                html += escape(afterString.substring(0, afterString.length - 1));
                html += `<span style="color: #d4d4d4;">:</span>`;
            } else {
                html += `<span style="color: #ce9178;">${escape(string)}</span>`;
            }
        } else if (number) {
            html += `<span style="color: #b5cea8;">${escape(number)}</span>`;
        } else if (boolean) {
            html += `<span style="color: #569cd6;">${escape(boolean)}</span>`;
        } else if (symbol) {
            html += `<span style="color: #d4d4d4;">${escape(symbol)}</span>`;
        }

        lastIndex = tokenRegex.lastIndex;
    }

    // Remaining text
    if (lastIndex < code.length) {
        html += escape(code.substring(lastIndex));
    }

    return html;
}
