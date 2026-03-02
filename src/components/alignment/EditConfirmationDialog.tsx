

import { AlertCircle, Check, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

interface EditConfirmationDialogProps {
    isOpen: boolean;
    mode: 'insert' | 'replace' | 'delete';
    originalText?: string;
    newText: string;
    startIndex: number;
    endIndex?: number;
    sequenceName: string;
    onConfirm: (dontAskAgain?: boolean, editedText?: string) => void;
    onCancel: () => void;
}

export function EditConfirmationDialog({
    isOpen,
    mode,
    originalText,
    newText,
    startIndex,
    // endIndex, // Unused
    sequenceName,
    onConfirm,
    onCancel
}: EditConfirmationDialogProps) {
    // Local state for checkbox
    const [dontAsk, setDontAsk] = useState(false);
    // Local state for editable text (for insert/replace)
    const [editableText, setEditableText] = useState(newText);
    const isDelete = mode === 'delete';

    // Update editableText when newText prop changes (dialog opens with new value)
    useEffect(() => {
        setEditableText(newText);
    }, [newText, isOpen]);

    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
            <div style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: 8,
                width: 400,
                maxWidth: '90%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: isDelete ? '#330000' : '#252526',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8
                }}>
                    <AlertCircle size={16} color={isDelete ? '#ff5252' : '#4fc3f7'} />
                    Confirm {isDelete ? 'Deletion' : (mode === 'insert' ? 'Insertion' : 'Replacement')}
                </div>

                {/* Content */}
                <div style={{ padding: 16 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#ccc' }}>
                        You are about to modify <strong>{sequenceName}</strong> at position {startIndex + 1}.
                    </p>

                    <div style={{ backgroundColor: '#111', padding: 12, borderRadius: 4, marginBottom: 12 }}>
                        {(mode === 'replace' || isDelete) && originalText && (
                            <div style={{ marginBottom: 8, fontSize: 12 }}>
                                <div style={{ color: '#666', marginBottom: 2 }}>{isDelete ? 'Deleting:' : 'Original:'}</div>
                                <div style={{ fontFamily: 'monospace', color: '#ff6666', wordBreak: 'break-all' }}>
                                    {originalText.length > 50 ? originalText.slice(0, 50) + '...' : originalText}
                                </div>
                            </div>
                        )}
                        {!isDelete && (
                            <div style={{ fontSize: 12 }}>
                                <div style={{ color: '#666', marginBottom: 4 }}>
                                    {mode === 'insert' ? 'Insert text:' : 'Replace with:'}
                                </div>
                                <input
                                    type="text"
                                    value={editableText}
                                    onChange={(e) => setEditableText(e.target.value.toUpperCase())}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && editableText.trim()) {
                                            e.preventDefault();
                                            onConfirm(dontAsk, editableText);
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            onCancel();
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        fontFamily: 'monospace',
                                        fontSize: 14,
                                        backgroundColor: '#1a1a1a',
                                        border: '1px solid #4fc3f7',
                                        borderRadius: 4,
                                        color: '#66ff66',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    placeholder="Type sequence..."
                                />
                            </div>
                        )}
                    </div>

                    {isDelete && (
                        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                id="dontAsk"
                                checked={dontAsk}
                                onChange={(e) => setDontAsk(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            <label htmlFor="dontAsk" style={{ fontSize: 12, color: '#ccc', cursor: 'pointer' }}>Do not ask again</label>
                        </div>
                    )}

                    <p style={{ margin: 0, fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                        Note: This will modify the sequence content and trigger a re-alignment. Original trace data (if any) will remain anchored to the original indices but may shift visually.
                    </p>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8
                }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCancel(); }}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: 4,
                            color: '#ccc',
                            cursor: 'pointer',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onConfirm(dontAsk, isDelete ? undefined : editableText); }}
                        disabled={!isDelete && !editableText.trim()}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: isDelete ? '#d32f2f' : '#4fc3f7',
                            border: 'none',
                            borderRadius: 4,
                            color: isDelete ? '#fff' : '#000',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        {isDelete ? <Trash2 size={14} /> : <Check size={14} />}
                        {isDelete ? 'Delete' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
