
import { Settings } from "lucide-react";
import { useState, useEffect } from "react";

interface StatusBarProps {
    onOpenSettings?: () => void;
}

export function StatusBar({ onOpenSettings }: StatusBarProps) {
    const [selectionInfo, setSelectionInfo] = useState<{ count: number; sequenceName?: string } | null>(null);

    useEffect(() => {
        const handleSelectionChange = (e: CustomEvent<{ count: number; sequenceName?: string } | null>) => {
            setSelectionInfo(e.detail);
        };

        window.addEventListener('alignment:selection', handleSelectionChange as EventListener);
        return () => window.removeEventListener('alignment:selection', handleSelectionChange as EventListener);
    }, []);

    return (
        <div className="status-bar">
            <div className="status-group">
            </div>

            <div className="status-group">
                {selectionInfo && selectionInfo.count > 0 && (
                    <div className="status-item" title={selectionInfo.sequenceName ? `Selected in ${selectionInfo.sequenceName}` : 'Selected bases'}>
                        <span>{selectionInfo.count} bp selected</span>
                    </div>
                )}
                <div className="status-item">
                    <span>UTF-8</span>
                </div>
                <div
                    className="status-item"
                    onClick={onOpenSettings}
                    style={{ cursor: 'pointer' }}
                    title="Open Settings"
                >
                    <Settings size={12} />
                </div>
            </div>
        </div>
    );
}
