import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { usePreferences } from "../app/Preferences";
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = usePreferences();
  return (
    <div
      className="skeleton-stack"
      role="status"
      aria-label={t("加载中", "Loading")}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-line" />
      ))}
      <span className="sr-only">{t("正在读取资料…", "Loading data…")}</span>
    </div>
  );
}
export function EmptyState({
  icon = "search",
  title,
  description,
  children,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {children}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="error-state" role="alert">
      <Icon name="info" />
      <div>
        <strong>
          {t("读取遇到问题", "Something interrupted the request")}
        </strong>
        <p>{message}</p>
      </div>
      <button onClick={retry}>{t("重试", "Retry")}</button>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <label className="search-input" htmlFor={id}>
      <Icon name="search" />
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        autoFocus={autoFocus}
      />
    </label>
  );
}
export function Tabs({
  items,
  label,
}: {
  items: { to: string; label: string; active: boolean; count?: number }[];
  label: string;
}) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={item.active ? "page" : undefined}
          className={item.active ? "active" : ""}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
export function Pagination({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  const { t } = usePreferences();
  return (
    <nav className="pagination" aria-label={t("分页", "Pagination")}>
      <button disabled={page <= 0} onClick={() => onPage(page - 1)}>
        {t("上一页", "Previous")}
      </button>
      <span>{t(`第 ${page + 1} 页`, `Page ${page + 1}`)}</span>
      <button disabled={!hasMore} onClick={() => onPage(page + 1)}>
        {t("下一页", "Next")}
      </button>
    </nav>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close?.();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="modal-content">
        <div className="section-heading">
          <h2 id={heading}>{title}</h2>
          <button
            className="icon-button"
            aria-label={title + " · Close"}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={setToast}>
      {children}
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast && (
          <>
            <Icon name="check" />
            {toast}
          </>
        )}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function CopyButton({
  value,
  label,
  iconOnly = false,
}: {
  value: string;
  label: string;
  iconOnly?: boolean;
}) {
  const { t } = usePreferences();
  const toast = useToast();
  const [manual, setManual] = useState(false);
  return (
    <>
      <button
        className={iconOnly ? "icon-button" : ""}
        title={label}
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(t("已复制", "Copied"));
          } catch {
            setManual(true);
          }
        }}
      >
        <Icon name="copy" />
        {!iconOnly && label}
      </button>
      {manual && (
        <Modal
          title={t("复制内容", "Copy content")}
          onClose={() => setManual(false)}
        >
          <p>
            {t(
              "选择下方内容进行复制。",
              "Select the content below to copy it.",
            )}
          </p>
          <textarea
            readOnly
            value={value}
            aria-label={t("待复制内容", "Content to copy")}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
    </>
  );
}
