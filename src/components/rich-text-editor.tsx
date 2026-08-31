"use client";

import { useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  BulletListIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  QuoteIcon,
  StrikeIcon,
  UnlinkIcon,
} from "./editor-icons";

type Props = {
  /** Имя скрытого поля — через него HTML уезжает в форму. */
  name: string;
  defaultValue?: string;
  /** Для живого предпросмотра: сообщает набранный HTML наружу. */
  onChange?: (html: string) => void;
};

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // Без preventDefault нажатие увело бы фокус из редактора,
      // и команда применилась бы в пустоту.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition ${
        active
          ? "bg-accent-fill text-on-accent"
          : "text-muted hover:bg-border/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const active = editor.isActive("link");

  function apply() {
    const value = url.trim();
    if (!value) return;
    // Голому «smartis.bi» браузер не поверит — достроим схему.
    const href = /^(https?:|mailto:|tel:)/i.test(value) ? value : `https://${value}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setUrl("");
    setOpen(false);
  }

  return (
    <span className="relative">
      <ToolbarButton
        title={active ? "Убрать ссылку" : "Вставить ссылку"}
        active={active}
        onClick={() => {
          if (active) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          setUrl(editor.getAttributes("link").href ?? "");
          setOpen((v) => !v);
        }}
      >
        {active ? <UnlinkIcon /> : <LinkIcon />}
      </ToolbarButton>

      {open ? (
        <span className="absolute top-9 left-0 z-10 flex gap-1 rounded-lg border border-border bg-background p-1.5 shadow-lg">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="https://…"
            className="w-56 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-accent"
          />
          <button
            type="button"
            onClick={apply}
            className="rounded-md bg-accent-fill px-2.5 text-sm text-on-accent"
          >
            ОК
          </button>
        </span>
      ) : null}
    </span>
  );
}

export function RichTextEditor({ name, defaultValue = "", onChange }: Props) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    // Обязательно для Next.js: без этого редактор пытается отрисоваться
    // на сервере, где нет DOM, и гидратация ломается.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Ссылки уже входят в StarterKit — отдельно подключать нельзя,
        // будет двойная регистрация расширения.
        link: {
          openOnClick: false, // в редакторе клик ставит курсор, а не уводит на сайт
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        },
      }),
    ],
    content: defaultValue,
    onUpdate: ({ editor }) => {
      const next = editor.getHTML();
      setHtml(next);
      onChange?.(next);
    },
    editorProps: {
      attributes: {
        class: "rich-text min-h-40 px-3 py-2.5",
      },
    },
  });

  if (!editor) {
    return (
      <div className="min-h-52 rounded-lg border border-border bg-background" />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background focus-within:border-accent">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1.5">
        <ToolbarButton
          title="Жирный"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          title="Курсив"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          title="Зачёркнутый"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikeIcon />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Заголовок"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading1Icon />
        </ToolbarButton>
        <ToolbarButton
          title="Подзаголовок"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading2Icon />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Маркированный список"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton
          title="Нумерованный список"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton
          title="Цитата"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <LinkControl editor={editor} />
      </div>

      <EditorContent editor={editor} />

      {/* Форма отправляется обычным способом — HTML едет скрытым полем. */}
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
