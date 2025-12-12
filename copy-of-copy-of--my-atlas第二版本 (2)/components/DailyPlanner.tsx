
import React, { useState, useContext } from 'react';
import { Bilingual, LanguageContext } from './Bilingual';
import { IconPlus, IconTrash } from './Icons';

interface PlanRow {
    id: number;
    start: string;
    end: string;
    activity: string;
}

interface Props {
    onCommit: (planText: string) => void;
    onClose: () => void;
}

export const DailyPlanner: React.FC<Props> = ({ onCommit, onClose }) => {
    const appLanguage = useContext(LanguageContext);
    const [rows, setRows] = useState<PlanRow[]>([
        { id: 1, start: '09:00', end: '10:00', activity: '' },
        { id: 2, start: '10:00', end: '12:00', activity: '' }
    ]);

    const addRow = () => {
        const lastRow = rows[rows.length - 1];
        const newStart = lastRow ? lastRow.end : '09:00';
        setRows([...rows, { 
            id: Date.now(), 
            start: newStart, 
            end: '', 
            activity: '' 
        }]);
    };

    const updateRow = (id: number, field: keyof PlanRow, value: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const removeRow = (id: number) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const handleCommit = () => {
        // Format the plan nicely for the chat
        const planString = "**MY DAILY PROTOCOL (今日计划):**\n\n" + 
            rows.map(r => `• ${r.start} - ${r.end}: ${r.activity || '(Undefined)'}`).join('\n');
        onCommit(planString);
    };

    // Helper for placeholders
    const loc = (en: string, zh: string) => {
        if (appLanguage === 'en') return en;
        if (appLanguage === 'zh') return zh;
        return `${en} (${zh})`;
    };

    return (
        <div className="absolute inset-0 bg-atlas-bg/95 backdrop-blur-sm z-30 flex flex-col p-8 animate-in fade-in slide-in-from-top-4 duration-300 font-serif">
            <div className="flex justify-between items-start mb-8 border-b border-atlas-text/10 pb-4">
                <Bilingual en="Protocol Architect" zh="计划构建器" className="text-atlas-text text-3xl font-serif italic" />
                <button 
                    onClick={onClose}
                    className="text-xs uppercase tracking-widest text-atlas-alert hover:text-red-700 transition-colors font-bold font-sans"
                >
                    <Bilingual en="Discard" zh="取消" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 bg-white p-4 rounded shadow-sm border border-atlas-dim/10 group transition-all hover:border-atlas-accent/30">
                        <div className="flex items-center gap-2 w-1/3">
                            <input 
                                type="time" 
                                value={row.start}
                                onChange={(e) => updateRow(row.id, 'start', e.target.value)}
                                className="bg-atlas-bg text-atlas-text text-xs p-2 rounded focus:outline-none focus:ring-1 focus:ring-atlas-accent font-sans uppercase tracking-wider"
                            />
                            <span className="text-atlas-dim font-sans">-</span>
                            <input 
                                type="time" 
                                value={row.end}
                                onChange={(e) => updateRow(row.id, 'end', e.target.value)}
                                className="bg-atlas-bg text-atlas-text text-xs p-2 rounded focus:outline-none focus:ring-1 focus:ring-atlas-accent font-sans uppercase tracking-wider"
                            />
                        </div>
                        <input 
                            type="text" 
                            placeholder={loc("Define Objective...", "定义目标...")}
                            value={row.activity}
                            onChange={(e) => updateRow(row.id, 'activity', e.target.value)}
                            className="flex-1 bg-transparent text-lg text-atlas-text placeholder:text-atlas-dim/30 focus:outline-none font-serif italic leading-relaxed"
                        />
                        <button 
                            onClick={() => removeRow(row.id)}
                            className="text-atlas-dim hover:text-atlas-alert opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <IconTrash />
                        </button>
                    </div>
                ))}
                
                <button 
                    onClick={addRow}
                    className="w-full py-4 border-2 border-dashed border-atlas-dim/10 text-atlas-dim hover:border-atlas-accent/50 hover:text-atlas-accent transition-all rounded flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold font-sans mt-4"
                >
                    <IconPlus /> <Bilingual en="Add Time Block" zh="添加时间块" />
                </button>
            </div>

            <div className="mt-6 pt-6 border-t border-atlas-dim/10">
                <button 
                    onClick={handleCommit}
                    className="w-full bg-atlas-text text-white py-4 rounded shadow-lg hover:bg-atlas-accent transition-colors flex flex-col items-center justify-center font-sans"
                >
                    <span className="text-sm font-bold uppercase tracking-widest"><Bilingual en="Initiate Protocol" zh="启动协议" /></span>
                    <span className="text-[10px] opacity-60 mt-1"><Bilingual en="Send to Atlas for supervision" zh="发送给Atlas进行监督" /></span>
                </button>
            </div>
        </div>
    );
};
