import { X, FileCode } from "lucide-react";

interface TabBarProps {
    tabs?: Array<{ name: string; path: string }>;
    activeTab?: string;
    onSelectTab?: (path: string) => void;
    onCloseTab?: (path: string) => void;
    modifiedFiles?: Set<string>;
}

export function TabBar({ tabs = [], activeTab, onSelectTab, onCloseTab, modifiedFiles }: TabBarProps) {
    if (tabs.length === 0) {
        return (
            <div className="tab-bar" style={{ borderBottom: '1px solid var(--border-color)' }}>
                {/* Empty tab bar */}
            </div>
        );
    }

    return (
        <div className="tab-bar">
            {tabs.map((tab) => (
                <Tab
                    key={tab.path}
                    name={tab.name}
                    active={tab.path === activeTab}
                    modified={modifiedFiles?.has(tab.path)}
                    onClick={() => onSelectTab?.(tab.path)}
                    onClose={() => onCloseTab?.(tab.path)}
                />
            ))}
        </div>
    )
}

function Tab({ name, active, modified, onClick, onClose }: { name: string, active?: boolean, modified?: boolean, onClick?: () => void, onClose?: () => void }) {
    return (
        <div className={`tab ${active ? 'active' : ''}`} onClick={onClick}>
            <FileCode size={14} color={active ? "#e37933" : "currentColor"} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {modified && <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#4fc3f7',
                marginLeft: 6
            }} />}
            <div
                className="tab-close"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                }}
            >
                <X size={14} />
            </div>
        </div>
    )
}
