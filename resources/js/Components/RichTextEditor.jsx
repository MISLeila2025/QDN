import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

/**
 * Minimal rich-text editor for "Details of Non-Conformity/Failure Mode".
 * Supports bold/italic/underline, bullet/numbered lists, and left/center/
 * right/justify alignment, per the spec's "write and format, align the
 * details" requirement. Emits HTML via onChange.
 *
 * Requires (npm install):
 *   @tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-underline
 */
export default function RichTextEditor({ value, onChange, error }) {
    const editor = useEditor({
        extensions: [
            // Newer @tiptap/starter-kit versions bundle their own Underline
            // extension by default -- disable it so the explicit
            // @tiptap/extension-underline import below is the only one
            // registered (avoids the "Duplicate extension names: ['underline']"
            // warning).
            StarterKit.configure({ underline: false }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content: value || '',
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            attributes: {
                class: 'qdn-rte-content',
            },
        },
    });

    if (!editor) return null;

    const ToolbarButton = ({ onClick, active, label, title }) => (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`qdn-rte-btn${active ? ' is-active' : ''}`}
        >
            {label}
        </button>
    );

    return (
        <div className={`qdn-rte${error ? ' has-error' : ''}`}>
            <div className="qdn-rte-toolbar">
                <ToolbarButton
                    title="Bold"
                    label="B"
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <ToolbarButton
                    title="Italic"
                    label="I"
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <ToolbarButton
                    title="Underline"
                    label="U"
                    active={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
                <span className="qdn-rte-sep" />
                <ToolbarButton
                    title="Bullet list"
                    label="•list"
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
                <ToolbarButton
                    title="Numbered list"
                    label="1.list"
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
                <span className="qdn-rte-sep" />
                <ToolbarButton
                    title="Align left"
                    label="⟸"
                    active={editor.isActive({ textAlign: 'left' })}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                />
                <ToolbarButton
                    title="Align center"
                    label="⟺"
                    active={editor.isActive({ textAlign: 'center' })}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                />
                <ToolbarButton
                    title="Align right"
                    label="⟹"
                    active={editor.isActive({ textAlign: 'right' })}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                />
                <ToolbarButton
                    title="Justify"
                    label="≡"
                    active={editor.isActive({ textAlign: 'justify' })}
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                />
            </div>
            <EditorContent editor={editor} />
            {error && <p className="qdn-field-error">{error}</p>}
        </div>
    );
}
