import { useState, useEffect, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function Calendar() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, [currentUser]);

  const fetchTasks = async () => {
    try {
      const q = query(
        collection(db, 'tasks'),
        where('createdBy', '==', currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform tasks into calendar events
  const events = useMemo(() => {
    return tasks.map(task => {
      const deadline = new Date(task.deadline);
      return {
        id: task.id,
        title: task.title,
        start: deadline,
        end: deadline,
        resource: task,
      };
    });
  }, [tasks]);

  const eventStyleGetter = (event) => {
    const task = event.resource;
    const isOverdue = new Date(task.deadline) < new Date();
    
    let backgroundColor = '#3b82f6'; // blue
    if (task.priority === 'high') backgroundColor = '#ef4444'; // red
    if (task.priority === 'medium') backgroundColor = '#f59e0b'; // orange
    if (isOverdue) backgroundColor = '#6b7280'; // gray

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
      },
    };
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-blue-600" />
            Task Calendar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            View all task deadlines in calendar view
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-slate-600 dark:text-slate-300">High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-sm text-slate-600 dark:text-slate-300">Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-slate-600 dark:text-slate-300">Low Priority</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
        />
      </div>

      {/* Selected Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white rounded-t-3xl">
              <h3 className="text-2xl font-bold">{selectedEvent.title}</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Clock className="h-5 w-5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Deadline</p>
                  <p className="font-semibold">{new Date(selectedEvent.deadline).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Users className="h-5 w-5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Assigned Classes</p>
                  <p className="font-semibold">{selectedEvent.assignedClasses?.length || 0} classes</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Description</p>
                <div 
                  className="text-slate-700 dark:text-slate-300 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Priority:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedEvent.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                  selectedEvent.priority === 'medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {selectedEvent.priority?.toUpperCase()}
                </span>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full mt-4 px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
