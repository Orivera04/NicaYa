"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Advertisement = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  backgroundColor: string;
  textColor: string;
};

export function AdvertisementCarousel() {
  const [items, setItems] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => { api<Advertisement[]>("/advertisements").then(setItems).catch(() => undefined); }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 5000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;
  const ad = items[index] || items[0];
  return <section className="mt-3 overflow-hidden rounded-2xl shadow-sm" aria-label="Publicidad">
    <article className="relative min-h-32 p-5" style={{ backgroundColor: ad.backgroundColor, color: ad.textColor }}>
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="relative max-w-[75%]"><p className="text-xs font-bold uppercase opacity-80">MotoYa te informa</p><h2 className="mt-1 text-xl font-bold leading-tight">{ad.title}</h2>{ad.description && <p className="mt-2 text-sm">{ad.description}</p>}{ad.actionUrl && <a href={ad.actionUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-white/20 px-3 py-2 text-sm font-bold">{ad.actionLabel || "Conocer más"}</a>}</div>
    </article>
    {items.length > 1 && <div className="flex justify-center gap-1.5 bg-white py-2">{items.map((item, itemIndex) => <button key={item.id} onClick={() => setIndex(itemIndex)} aria-label={`Ver anuncio ${itemIndex + 1}`} className={`h-2 w-2 rounded-full p-0 ${itemIndex === index ? "bg-orange-500" : "bg-slate-300"}`} />)}</div>}
  </section>;
}
