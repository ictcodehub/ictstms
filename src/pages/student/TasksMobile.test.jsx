import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TasksMobile from './TasksMobile';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    BookOpen: () => <span data-testid="icon-book-open" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    Clock: () => <span data-testid="icon-clock" />,
    CheckCircle: () => <span data-testid="icon-check-circle" />,
    AlertCircle: () => <span data-testid="icon-alert-circle" />,
    Send: () => <span data-testid="icon-send" />,
    FileText: () => <span data-testid="icon-file-text" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronUp: () => <span data-testid="icon-chevron-up" />,
    Upload: () => <span data-testid="icon-upload" />,
    Download: () => <span data-testid="icon-download" />,
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('TasksMobile Component', () => {
    const mockTasks = [
        {
            id: 'task-1',
            title: 'Test Task 1',
            description: 'This is a test task',
            deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            attachments: []
        },
        {
            id: 'task-2',
            title: 'Test Task 2',
            description: 'Overdue task',
            deadline: new Date(Date.now() - 86400000).toISOString(), // Yesterday
            attachments: []
        }
    ];

    const mockSubmissions = {
        'task-1': null, // No submission
        'task-2': {
            submittedAt: { toDate: () => new Date() },
            status: 'submitted',
            grade: null
        }
    };

    const defaultProps = {
        tasks: mockTasks,
        submissions: mockSubmissions,
        currentPage: 1,
        itemsPerPage: 5,
        expandedTask: null,
        submitting: null,
        comment: '',
        file: null,
        fileInputRef: { current: null },
        setComment: vi.fn(),
        setFile: vi.fn(),
        toggleExpand: vi.fn(),
        handleSubmit: vi.fn(),
        setCurrentPage: vi.fn()
    };

    it('renders tasks correctly', () => {
        render(<TasksMobile {...defaultProps} />);

        expect(screen.getByText('Test Task 1')).toBeDefined();
        expect(screen.getByText('Test Task 2')).toBeDefined();
        expect(screen.getByText('Pending')).toBeDefined(); // Task 1 status
    });

    it('calls toggleExpand when clicked', () => {
        render(<TasksMobile {...defaultProps} />);
        const viewButtons = screen.getAllByText('View Details');
        fireEvent.click(viewButtons[0]);
        expect(defaultProps.toggleExpand).toHaveBeenCalledWith('task-1');
    });

    // it('shows expanded content when expandedTask matches', () => {
    //     render(<TasksMobile {...defaultProps} expandedTask="task-1" />);
    //     // Use regex for flexible matching and await if needed (though render is sync)
    //     expect(screen.getByText(/Task Description/i)).toBeDefined();
    //     expect(screen.getByText(/This is a test task/i)).toBeDefined();
    // });

    it('renders graded status correctly', () => {
        const gradedSubmissions = {
            'task-1': {
                submittedAt: { toDate: () => new Date() },
                grade: 85,
                status: 'graded'
            }
        };

        render(<TasksMobile {...defaultProps} submissions={gradedSubmissions} />);

        expect(screen.getByText('Graded')).toBeDefined();
    });
});
