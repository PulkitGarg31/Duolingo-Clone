import { Button } from "@/components/ui/Button";
import { FooterFrame } from "./FooterFrame";

interface CheckFooterProps {
  /** The draft answers the exercise. */
  canCheck: boolean;
  /** The answer is on its way: CHECK shows its loading dots. */
  checking: boolean;
  /** SKIP and CHECK stay put but cannot be pressed (an overlay or a request is up). */
  disabled?: boolean;
  onCheck(): void;
  onSkip(): void;
}

/** SKIP (wide screens only) and CHECK, which is grey until there is an answer. */
export function CheckFooter({ canCheck, checking, disabled = false, onCheck, onSkip }: CheckFooterProps) {
  return (
    <FooterFrame>
      {/* Phones show CHECK alone. The wrapper hides SKIP: the button sets its own display. */}
      <div className="hidden md:block">
        <Button variant="outline-muted" size="lg" disabled={disabled || checking} onClick={onSkip}>
          Skip
        </Button>
      </div>
      <Button
        size="lg"
        disabled={!canCheck || disabled}
        loading={checking}
        onClick={onCheck}
        className="md:col-start-5 md:justify-self-end"
      >
        Check
      </Button>
    </FooterFrame>
  );
}

interface ActionFooterProps {
  label: string;
  onClick(): void;
  loading?: boolean;
  disabled?: boolean;
}

/** A footer with a single green action on the right: CONTINUE after a coach slide, TRY AGAIN after an error. */
export function ActionFooter({ label, onClick, loading = false, disabled = false }: ActionFooterProps) {
  return (
    <FooterFrame>
      <Button size="lg" autoFocus loading={loading} disabled={disabled} onClick={onClick} className="md:col-start-5 md:justify-self-end">
        {label}
      </Button>
    </FooterFrame>
  );
}
