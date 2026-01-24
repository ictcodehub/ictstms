import { Editor } from '@tinymce/tinymce-react';
import { useRef } from 'react';

// Using the user-provided API key
const API_KEY = 'n64afzc4x0dfs7x0hh3ng4ennxamloyjhpijxefa9jlzf7ue';

const style = `
.tox-editor-header {
    background-color: #f8fafc !important;
    border-bottom: 1px solid #e2e8f0 !important;
    padding: 4px !important;
}
.tox-sidebar-wrap {
    margin-top: 0 !important;
}
/* Uniform toolbar group spacing */
.tox-toolbar__group {
    padding: 0 3px !important;
    margin: 0 !important;
    border-right: 1px solid #e2e8f0 !important;
    gap: 2px !important;
    display: flex !important;
    align-items: center !important;
}
.tox-toolbar__group:last-of-type {
    border-right: none !important;
}
/* Regular buttons */
.tox-tbtn {
    margin: 0 !important;
    height: 30px !important;
    min-width: 30px !important;
}
/* Split buttons - compact, chevron close to icon */
.tox-split-button {
    margin: 0 !important;
    gap: 0 !important;
    padding: 0 !important;
}
/* Make chevron smaller and closer to icon */
.tox-split-button__chevron {
    width: 10px !important;
    padding: 0 !important;
    margin-left: -6px !important;
}
/* Make font family dropdown fixed width */
.tox-tbtn--bespoke {
    width: 80px !important;
    margin: 0 !important;
}
.tox-tbtn__select-label {
    width: 60px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
}
/* Ensure dropdowns don't get cut off */
.tox-collection {
    max-height: 400px !important;
}
`;

export default function RichTextEditor({ value, onChange, placeholder, height = 300, disabled = false, isMobile = false }) {
    const editorRef = useRef(null);

    // Config based on mobile state
    const toolbarMode = 'sliding'; // Both use sliding - overflow items go to "..." menu

    // Desktop: only free features
    const desktopToolbar = 'fontfamily fontsize | bold italic underline | align lineheight | numlist bullist indent outdent | forecolor | link media | backcolor | table | strikethrough | emoticons charmap | removeformat';

    // Mobile: Core features only
    const mobileToolbar = 'bold italic underline | forecolor | numlist bullist | link | removeformat';

    const toolbarItems = isMobile ? mobileToolbar : desktopToolbar;

    return (
        <div className="rounded-xl overflow-hidden border border-slate-300 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all bg-white">
            <style>{style}</style>
            <Editor
                apiKey={API_KEY}
                onInit={(evt, editor) => editorRef.current = editor}
                value={value}
                onEditorChange={(content) => onChange(content)}
                disabled={disabled}
                init={{
                    min_height: height,
                    max_height: 600,
                    menubar: false,
                    resize: false,
                    plugins: [
                        // Core editing features (FREE)
                        'anchor', 'autolink', 'charmap', 'emoticons', 'link', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount', 'autoresize'
                    ],
                    toolbar: toolbarItems,
                    toolbar_mode: toolbarMode,
                    mobile: {
                        toolbar_mode: 'sliding',
                        toolbar: mobileToolbar,
                        menubar: false,
                        plugins: ['autoresize', 'lists', 'link', 'autolink']
                    },
                    tinycomments_mode: 'embedded',
                    tinycomments_author: 'Author name',
                    mergetags_list: [
                        { value: 'First.Name', title: 'First Name' },
                        { value: 'Email', title: 'Email' },
                    ],
                    ai_request: (request, respondWith) => respondWith.string(() => Promise.reject('See docs to implement AI Assistant')),
                    uploadcare_public_key: '314ce7a68e7d736f76c7',
                    content_style: 'body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px }',
                    placeholder: placeholder,
                    statusbar: false,
                }}
            />
        </div>
    );
}
