import { Trash2, CheckSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BulkActionsBar({ 
  selectedCount, 
  onClear, 
  onDelete, 
  onAction,
  actions = [],
  isProcessing = false 
}) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            <span className="font-bold">{selectedCount} selected</span>
          </div>

          <div className="h-8 w-px bg-white/30"></div>

          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </button>
          ))}

          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}

          <button
            onClick={onClear}
            disabled={isProcessing}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
