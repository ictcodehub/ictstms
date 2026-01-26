import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useRef, useEffect } from 'react';

// 1. Register Custom Font Sizes
const Size = Quill.import('attributors/style/size');
const validSizes = ['10px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '32px'];
Size.whitelist = validSizes;
Quill.register(Size, true);

// 2. Register Custom Fonts
const Font = Quill.import('attributors/style/font');
const validFonts = ['arial', 'calibri', 'comic-sans', 'courier-new', 'georgia', 'helvetica', 'lucida', 'roboto', 'tahoma', 'times-new-roman', 'trebuchet', 'verdana'];
Font.whitelist = validFonts;
Quill.register(Font, true);


// Custom styling to match the previous design + Custom Fonts/Sizes
const customStyles = `
  /* EDITOR BASE STYLES */
  .ql-container {
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    border-bottom-left-radius: 0.75rem !important;
    border-bottom-right-radius: 0.75rem !important;
  }
  .ql-toolbar {
    border-top-left-radius: 0.75rem !important;
    border-top-right-radius: 0.75rem !important;
    background-color: #ffffff !important; /* White background like reference */
    border-color: #e2e8f0 !important;
    padding: 8px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0px !important; /* We use margins on formats */
    align-items: center !important;
  }
  .ql-container.ql-snow {
    border-color: #e2e8f0 !important;
  }
  .ql-editor {
    min-height: 200px;
  }
  .ql-editor.ql-blank::before {
    font-style: normal;
    color: #94a3b8;
  }

  /* DROPDOWN SCROLLING FIX */
  .ql-snow .ql-picker-options {
    max-height: 200px;
    overflow-y: auto;
  }

  /* TOOLBAR GROUPS & SEPARATORS */
  .ql-formats {
    margin-right: 0 !important;
    padding-right: 8px !important; /* Reduced from 12px */
    margin-left: 8px !important;   /* Reduced from 12px */
    border-right: 1px solid #e2e8f0;
    display: flex !important;
    align-items: center !important;
    gap: 4px;
  }
  .ql-formats:first-child {
    margin-left: 0 !important;
  }
  .ql-formats:last-child {
    border-right: none !important;
    padding-right: 0 !important;
  }

  /* BUTTON STYLING */
  .ql-snow.ql-toolbar button {
    width: 28px !important;
    height: 28px !important;
    padding: 4px !important;
    border-radius: 6px !important;
    color: #64748b !important; /* Slate-500 */
    transition: all 0.2s;
  }
  .ql-snow.ql-toolbar button:hover {
    background-color: #f1f5f9 !important; /* Slate-100 */
    color: #0f172a !important; /* Slate-900 */
  }
  .ql-snow.ql-toolbar button.ql-active {
    background-color: #eff6ff !important; /* Blue-50 */
    color: #2563eb !important; /* Blue-600 */
  }
  
  /* ICONS COLOR */
  .ql-snow .ql-stroke {
    stroke: #64748b !important;
  }
  .ql-snow .ql-fill {
    fill: #64748b !important;
  }
  .ql-snow button:hover .ql-stroke {
    stroke: #0f172a !important;
  }
  .ql-snow button:hover .ql-fill {
    fill: #0f172a !important;
  }
  .ql-snow button.ql-active .ql-stroke {
    stroke: #2563eb !important;
  }
  .ql-snow button.ql-active .ql-fill {
    fill: #2563eb !important;
  }

  /* TRUNCATE LONG FONT NAMES IN LABEL */
  .ql-snow .ql-picker.ql-font {
    width: 125px !important;
  }
  .ql-snow .ql-picker.ql-font .ql-picker-label {
    padding-right: 32px !important; /* Increase padding to fully clear the arrow */
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    display: inline-block !important;
    width: 100% !important;
  }
  .ql-snow .ql-picker.ql-font .ql-picker-label::before {
    display: inline !important; /* Ensure pseudo-element text flows for ellipsis */
  }

  /* CUSTOM FONT & SIZE DROPDOWN LABELS */
  /* FONTS */
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before { content: 'Arial'; font-family: 'Arial'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="calibri"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="calibri"]::before { content: 'Calibri'; font-family: 'Calibri'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="comic-sans"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="comic-sans"]::before { content: 'Comic Sans MS'; font-family: 'Comic Sans MS'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="courier-new"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="courier-new"]::before { content: 'Courier New'; font-family: 'Courier New'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="georgia"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="georgia"]::before { content: 'Georgia'; font-family: 'Georgia'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="helvetica"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="helvetica"]::before { content: 'Helvetica'; font-family: 'Helvetica'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="lucida"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="lucida"]::before { content: 'Lucida Sans'; font-family: 'Lucida Sans'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="roboto"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="roboto"]::before { content: 'Roboto'; font-family: 'Roboto'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="tahoma"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="tahoma"]::before { content: 'Tahoma'; font-family: 'Tahoma'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="times-new-roman"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="times-new-roman"]::before { content: 'Times New Roman'; font-family: 'Times New Roman'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="trebuchet"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="trebuchet"]::before { content: 'Trebuchet MS'; font-family: 'Trebuchet MS'; }
  
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="verdana"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="verdana"]::before { content: 'Verdana'; font-family: 'Verdana'; }


  /* SIZES */
  .ql-snow .ql-picker.ql-size .ql-picker-label::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item::before { content: '14px'; } /* Default */

  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before { content: '10px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12px"]::before { content: '12px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="13px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="13px"]::before { content: '13px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14px"]::before { content: '14px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="16px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="16px"]::before { content: '16px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="18px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="18px"]::before { content: '18px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="20px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="20px"]::before { content: '20px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="24px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="24px"]::before { content: '24px'; }
  
  .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="32px"]::before,
  .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="32px"]::before { content: '32px'; }
`;

export default function RichTextEditor({ value, onChange, placeholder, height = 300, disabled = false, isMobile = false }) {
  const quillRef = useRef(null);

  // Add tooltips to toolbar buttons
  useEffect(() => {
    // Small delay to ensure DOM is ready and Quill has rendered the toolbar
    const timer = setTimeout(() => {
      const tooltipMap = {
        '.ql-bold': 'Bold',
        '.ql-italic': 'Italic',
        '.ql-underline': 'Underline',
        '.ql-strike': 'Strikethrough',
        '.ql-list[value="ordered"]': 'Numbered List',
        '.ql-list[value="bullet"]': 'Bulleted List',
        '.ql-indent[value="-1"]': 'Decrease Indent',
        '.ql-indent[value="+1"]': 'Increase Indent',
        '.ql-link': 'Insert Link',
        '.ql-image': 'Insert Image',
        '.ql-clean': 'Clear Formatting',
        '.ql-color': 'Text Color',
        '.ql-background': 'Background Color',
        '.ql-header .ql-picker-label': 'Heading Style',
        '.ql-font .ql-picker-label': 'Font Family',
        '.ql-size .ql-picker-label': 'Font Size'
      };

      Object.keys(tooltipMap).forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!el.getAttribute('title')) {
            el.setAttribute('title', tooltipMap[selector]);
          }
        });
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Custom Toolbar Configuration
  const modules = {
    toolbar: isMobile ? [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ] : [
      [{ 'font': validFonts }, { 'size': validSizes }],
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'clean']
    ],
    clipboard: {
      // Setup clipboard to handle paste
      matchVisual: false,
    }
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background'
  ];

  return (
    <div className="rounded-xl shadow-sm transition-all bg-white relative">
      <style>{customStyles}</style>
      <div
        className={`bg-white rounded-xl ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        style={{ minHeight: height }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          readOnly={disabled}
          style={{ height: height }}
          className="rounded-xl overflow-hidden"
        />
      </div>
    </div>
  );
}
