import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("Uncaught error:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full min-h-[300px] flex items-center justify-center bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
                            {/* AlertTriangle icon inline svg since we can't import lucide easily in class components unless passed or global */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Statement Display Error</h3>
                        <p className="text-slate-500 text-sm">
                            We encountered an issue rendering this question.
                        </p>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-left overflow-auto max-h-32 text-xs font-mono text-slate-400">
                            {this.state.error && this.state.error.toString()}
                        </div>

                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                        >
                            <span>Reload Question</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
