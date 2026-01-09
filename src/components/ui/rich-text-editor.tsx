"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon, Undo, Redo } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
}

export function RichTextEditor({ 
    content, 
    onChange, 
    placeholder = "Write your content here...",
    className,
    minHeight = "200px"
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 underline cursor-pointer',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: content || '',
        editorProps: {
            attributes: {
                class: cn(
                    'prose prose-sm max-w-none focus:outline-none',
                    'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
                    'prose-li:my-0',
                    '[&_ul]:list-disc [&_ul]:pl-4',
                    '[&_ol]:list-decimal [&_ol]:pl-4'
                ),
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        immediatelyRender: false,
    });

    // Update editor content when content prop changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '');
        }
    }, [content, editor]);

    if (!editor) {
        return (
            <div className={cn("border rounded-lg p-4 bg-muted/50", className)} style={{ minHeight }}>
                Loading editor...
            </div>
        );
    }

    const addLink = () => {
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    return (
        <div className={cn("border rounded-lg overflow-hidden", className)}>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('bold') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('italic') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('underline') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Underline (Ctrl+U)"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('strike') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                >
                    <Strikethrough className="h-4 w-4" />
                </Button>
                
                <div className="w-px h-6 bg-border mx-1 self-center" />
                
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('bulletList') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('orderedList') && "bg-muted")}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
                
                <div className="w-px h-6 bg-border mx-1 self-center" />
                
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", editor.isActive('link') && "bg-muted")}
                    onClick={addLink}
                    title="Add Link"
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>
                
                <div className="w-px h-6 bg-border mx-1 self-center" />
                
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo className="h-4 w-4" />
                </Button>
            </div>
            
            {/* Editor Content */}
            <div 
                className="p-4 bg-background cursor-text"
                style={{ minHeight }}
                onClick={() => editor.chain().focus().run()}
            >
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

// Function to insert text at cursor position
export function insertTextAtCursor(editor: any, text: string) {
    if (editor) {
        editor.chain().focus().insertContent(text).run();
    }
}

