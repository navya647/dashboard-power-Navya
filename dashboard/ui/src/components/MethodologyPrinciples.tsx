const PRINCIPLES = [
  { title: 'Source Fidelity', body: 'Reported wording and values are preserved exactly as extracted.' },
  { title: 'No Invented Data', body: 'Missing values remain N/A — never zero, never interpolated.' },
  { title: 'Compare Only When Valid', body: 'The dashboard never infers compliance across incompatible metrics.' },
  { title: 'Preserve Source Definitions', body: 'Original indicator names and definitions remain traceable to their source.' },
  { title: 'Traceable Evidence', body: 'Regulatory citations stay attached to the observations they govern.' },
];

/** A vertical numbered/rule layout, not five separate cards. */
export default function MethodologyPrinciples() {
  return (
    <ol className="principles-list">
      {PRINCIPLES.map((p, i) => (
        <li className="principles-item" key={p.title}>
          <span className="principles-num">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div className="principles-title">{p.title}</div>
            <p className="principles-body">{p.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
