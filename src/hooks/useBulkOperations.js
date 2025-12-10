import { useState } from 'react';
import { deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useBulkOperations() {
  const [selectedItems, setSelectedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleAll = (items) => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const bulkDelete = async (collectionName) => {
    if (selectedItems.length === 0) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      selectedItems.forEach(id => {
        batch.delete(doc(db, collectionName, id));
      });

      await batch.commit();
      
      clearSelection();
      return { success: true, count: selectedItems.length };
    } catch (error) {
      console.error('Bulk delete error:', error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkUpdate = async (collectionName, updates) => {
    if (selectedItems.length === 0) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      selectedItems.forEach(id => {
        batch.update(doc(db, collectionName, id), updates);
      });

      await batch.commit();
      
      clearSelection();
      return { success: true, count: selectedItems.length };
    } catch (error) {
      console.error('Bulk update error:', error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkGrade = async (submissions, grade, feedback = '') => {
    if (selectedItems.length === 0) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      selectedItems.forEach(id => {
        batch.update(doc(db, 'submissions', id), {
          grade: parseFloat(grade),
          feedback,
          gradedAt: new Date(),
        });
      });

      await batch.commit();
      
      clearSelection();
      return { success: true, count: selectedItems.length };
    } catch (error) {
      console.error('Bulk grade error:', error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    selectedItems,
    isProcessing,
    toggleItem,
    toggleAll,
    clearSelection,
    bulkDelete,
    bulkUpdate,
    bulkGrade,
  };
}
