import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Field, ErrorBox } from "../components/ui";

const words = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function WriteReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/products/${id}`).then(setProduct).catch((e) => setError(e.message)); }, [id]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!rating) { setError("Please choose a star rating."); return; }
    setBusy(true);
    try {
      await api(`/products/${id}/reviews`, { method: "POST", body: { rating, title, body } });
      setDone(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="card mx-auto mt-6 max-w-[600px] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-3xl font-bold">✓</div>
        <h1 className="font-display text-4xl">Thanks for your review</h1>
        <p className="mt-2 text-muted">Your review will show on the product page.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/orders" className="btn-gold">Back to my orders</Link>
          <Link to={`/products/${id}`} className="btn-outline">View product</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[780px]">
      <h1 className="font-display text-4xl mb-6">Write a review</h1>
      {product && <div className="card mb-5 p-5"><p className="font-bold">{product.name}</p><p className="text-sm text-muted">Sold by {product.seller.shop_name}</p></div>}
      <form onSubmit={submit} className="card p-6" noValidate>
        <ErrorBox>{error}</ErrorBox>
        <p className="font-bold">Your rating</p>
        <div className="mb-5 mt-2 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={`text-5xl leading-none ${n <= rating ? "text-gold" : "text-[#C9BC99]"}`}>{n <= rating ? "★" : "☆"}</button>
          ))}
          <span className="ml-3 font-bold">{words[rating]}</span>
        </div>
        <Field label="Review title (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="Sum it up in a few words" /></Field>
        <Field label="Your review"><textarea className="input min-h-[140px] py-3" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you like or dislike about this product?" /></Field>
        <p className="mb-4 text-right text-xs text-muted">{body.length}/2000</p>
        <div className="flex gap-3">
          <button className="btn-gold px-8" disabled={busy}>{busy ? "Submitting..." : "Submit review"}</button>
          <button type="button" className="btn-outline" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
