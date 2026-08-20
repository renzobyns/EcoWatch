import { useEffect, useRef } from 'react';
import { useShortcutsContext, ShortcutAction } from '@/contexts/ShortcutsContext';

export function useKeyboardShortcuts(actionsMap: Partial<Record<ShortcutAction, () => void>>) {
    const { shortcuts } = useShortcutsContext();
    // Use ref for actionsMap so we don't rebind event listener on every render if actionsMap identity changes
    const actionsRef = useRef(actionsMap);

    useEffect(() => {
        actionsRef.current = actionsMap;
    }, [actionsMap]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
                return;
            }

            let key = e.key.toLowerCase();
            if (key === ' ') key = 'space';
            
            const withCtrl = e.ctrlKey || e.metaKey;
            const withShift = e.shiftKey;
            const withAlt = e.altKey;
            
            let combo = '';
            if (withCtrl) combo += 'ctrl+';
            if (withAlt) combo += 'alt+';
            if (withShift) combo += 'shift+';
            combo += key;

            // Find if this combo exactly matches any registered action
            const triggeredAction = (Object.keys(shortcuts) as ShortcutAction[]).find(
                action => shortcuts[action] === combo
            );

            if (triggeredAction && actionsRef.current[triggeredAction]) {
                e.preventDefault();
                actionsRef.current[triggeredAction]!();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}
