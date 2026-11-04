import './BotonOjoMontos.css';

function IconoOjo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-2.2 3.2" />
      <path d="M6.6 6.6C4.1 8.3 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.4-.9" />
    </svg>
  );
}

export default function BotonOjoMontos({ visibles, onAlternar }) {
  return (
    <button
      type="button"
      className="boton-ojo-montos"
      aria-pressed={visibles}
      aria-label={visibles ? 'Ocultar montos de la jornada' : 'Mostrar montos de la jornada'}
      onClick={onAlternar}
    >
      {visibles ? <IconoOjoTachado /> : <IconoOjo />}
    </button>
  );
}
