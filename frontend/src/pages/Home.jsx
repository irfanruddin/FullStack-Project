import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, imageUrl } from "../api";
import ProductCard from "../components/ProductCard";

// Full-width banner: back and forward buttons, dots, changes by itself every 10 seconds.
function Banner({ slides }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (n) => setI((n + slides.length) % slides.length);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    const timer = setInterval(() => setI((x) => (x + 1) % slides.length), 10000);
    return () => clearInterval(timer);
  }, [paused, slides.length, i]);          // i in the list: a manual click restarts the 10 seconds

  const s = slides[i];
  const bg = imageUrl(s.image);
  return (
    <div className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 bg-[#1A1A1A]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <div className="absolute inset-y-0 left-0 w-1/2 bg-black/45" />
      <div className="relative mx-auto flex min-h-[420px] max-w-[1200px] items-center justify-between gap-10 px-6 pb-20 pt-10">
        <div>
          <h1 className="font-display text-5xl leading-tight text-cream md:text-6xl">{s.title}</h1>
          <p className="mt-3 text-xl text-gold">{s.subtitle}</p>
          <Link to={s.link} className="btn-gold mt-7 px-9">{s.cta}</Link>
        </div>
        {!bg && (
          <div className="hidden items-end gap-4 md:flex" aria-hidden="true">
            <div className="h-36 w-24 rounded-t-full rounded-b-xl bg-[#E8D9A8]" />
            <div className="h-60 w-32 rounded-2xl bg-gold" />
            <div className="h-44 w-24 rounded-b-full rounded-t-xl bg-cream" />
          </div>
        )}
      </div>
      <button onClick={() => go(i - 1)} aria-label="Previous slide" className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-card text-xl">‹</button>
      <button onClick={() => go(i + 1)} aria-label="Next slide" className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-card text-xl">›</button>
      <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-2">
        {slides.map((x, n) => (
          <button key={x.id} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`}
            className={`h-2 rounded-full ${n === i ? "w-7 bg-gold" : "w-2 bg-cream"}`} />
        ))}
      </div>
    </div>
  );
}

function Row({ title, items, link }) {
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-3xl">{title}</h2>
        <Link to={link} className="link text-sm">View all</Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/home", { auth: false }).then(setData).catch((e) => setError(e.message));
    api("/categories", { auth: false }).then(setCats).catch(() => {});
  }, []);

  if (error) return <div className="card p-10 text-center text-red-800">{error}</div>;
  if (!data) return <p className="text-muted">Loading...</p>;

  return (
    <div>
      <Banner slides={data.banners} />
      <div className="relative -mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {data.offers.map((o) => (
          <div key={o.title} className="card flex items-center gap-4 p-5 shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-[#F1E6C8]" />
            <div><p className="font-display text-xl font-semibold">{o.title}</p><p className="text-sm text-muted">{o.text}</p></div>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-3xl">Shop by category</h2>
            <div className="mt-1 h-1 w-12 rounded-full bg-gold" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cats.map((c) => (
            <div
              key={c.id}
              className="customer-category-card group flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-6 shadow-sm hover:border-gold/60 hover:shadow-md transition-all duration-200"
            >
              <div>
                {/* 1. Category Title */}
                <div className="mb-4">
                  <Link
                    to={`/category/${c.id}`}
                    className="font-display text-xl font-bold text-ink transition-colors group-hover:text-gold-dark inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-1 h-0.5 w-7 rounded-full bg-gold/60 transition-all duration-300 group-hover:w-12" />
                </div>

                {/* 2. Subcategory Chips */}
                <div className="flex flex-wrap gap-2">
                  {c.children.map((s) => (
                    <Link
                      key={s.id}
                      to={`/category/${c.id}?sub_id=${s.id}`}
                      className="inline-flex items-center rounded-full bg-[#F1E6C8]/75 px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-gold hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* 3. Shop Category Action */}
              <div className="mt-5 border-t border-line/60 pt-4">
                <Link
                  to={`/category/${c.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-dark transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                >
                  <span>Shop {c.name.toLowerCase()}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Row title="Trending now" items={data.trending} link="/products?sort=popularity" />
      <Row title="Top rated" items={data.top_rated} link="/products?sort=rating" />
      <Row title="New arrivals" items={data.new_arrivals} link="/products?sort=newest" />
    </div>
  );
}
