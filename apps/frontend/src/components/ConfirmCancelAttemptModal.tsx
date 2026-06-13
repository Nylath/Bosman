type ConfirmCancelAttemptModalProps = {
  isOpen: boolean;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmCancelAttemptModal(
  props: ConfirmCancelAttemptModalProps,
) {
  if (!props.isOpen) {
    return null;
  }

  return (
    <div
      className="attempt-cancel-modal__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !props.isCancelling
        ) {
          props.onClose();
        }
      }}
    >
      <section
        aria-labelledby="attempt-cancel-modal-title"
        aria-modal="true"
        className="attempt-cancel-modal"
        role="dialog"
      >
        <p className="attempt-cancel-modal__eyebrow">
          Potwierdź decyzję
        </p>

        <h2 id="attempt-cancel-modal-title">
          Przerwać egzamin?
        </h2>

        <p>
          Obecne podejście zostanie zakończone. Nie
          będzie można do niego wrócić i nie pojawi
          się ono w historii wyników.
        </p>

        <div className="attempt-cancel-modal__actions">
          <button
            className="attempt-cancel-modal__secondary-button"
            type="button"
            disabled={props.isCancelling}
            onClick={props.onClose}
          >
            Anuluj
          </button>

          <button
            className="attempt-cancel-modal__danger-button"
            type="button"
            disabled={props.isCancelling}
            onClick={props.onConfirm}
          >
            {props.isCancelling
              ? "Przerywanie…"
              : "Tak, przerwij egzamin"}
          </button>
        </div>
      </section>
    </div>
  );
}