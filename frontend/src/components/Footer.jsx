export default function Footer({ meta = "free url shortener with analytics" }) {
  return (
    <footer className="pagefoot">
      <div className="container row-between">
        <span>© Trunc · 2026</span>
        <span className="meta">{meta}</span>
      </div>
    </footer>
  );
}
