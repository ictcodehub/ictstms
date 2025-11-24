// Utility function to detect and linkify URLs in text
export const linkifyText = (text) => {
    if (!text) return null;

    // Regular expression to match URLs
    // Matches http://, https://, and www. URLs
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: text.substring(lastIndex, match.index)
            });
        }

        // Add the URL
        let url = match[0];
        // Add https:// if it starts with www.
        const href = url.startsWith('www.') ? `https://${url}` : url;

        parts.push({
            type: 'link',
            content: url,
            href: href
        });

        lastIndex = match.index + url.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            content: text.substring(lastIndex)
        });
    }

    // If no URLs found, return original text
    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

// Component to render linkified text
export const LinkifiedText = ({ text, className = '' }) => {
    const parts = linkifyText(text);

    if (!parts) return null;

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.type === 'link') {
                    return (
                        <a
                            key={index}
                            href={part.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline font-medium break-all inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part.content}
                            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    );
                }
                return <span key={index}>{part.content}</span>;
            })}
        </span>
    );
};
