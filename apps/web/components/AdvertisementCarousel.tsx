"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
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

const swipeThreshold = 44;

export function AdvertisementCarousel() {
  const [items, setItems] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    api<Advertisement[]>("/advertisements").then(setItems).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 5000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  const goTo = (next: number) => {
    if (!items.length) return;
    setIndex((next + items.length) % items.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined || Math.abs(start - end) < swipeThreshold) return;
    goTo(index + (start > end ? 1 : -1));
  };

  if (!items.length) return null;

  return <section className="advertisement-carousel" aria-label="Novedades de MotoYa">
    <div className="advertisement-carousel__viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="advertisement-carousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((ad, itemIndex) => <article key={ad.id} className="advertisement-carousel__slide" aria-hidden={itemIndex !== index} style={{ backgroundColor: ad.backgroundColor, color: ad.textColor }}>
          {ad.imageUrl && <img src={ad.imageUrl} alt="" className="advertisement-carousel__image" />}
          <div className="advertisement-carousel__shade" />
          <div className="advertisement-carousel__content">
            <p>MOTOYA TE INFORMA</p>
            <h2>{ad.title}</h2>
            {ad.description && <span>{ad.description}</span>}
            {ad.actionUrl && <a href={ad.actionUrl} target="_blank" rel="noreferrer" tabIndex={itemIndex === index ? 0 : -1}>{ad.actionLabel || "Conocer más"}<b aria-hidden="true">→</b></a>}
          </div>
        </article>)}
      </div>
    </div>
    {items.length > 1 && <div className="advertisement-carousel__pagination" role="tablist" aria-label="Seleccionar novedad">
      {items.map((item, itemIndex) => <button key={item.id} type="button" role="tab" aria-selected={itemIndex === index} aria-label={`Ver novedad ${itemIndex + 1}`} onClick={() => goTo(itemIndex)} className={itemIndex === index ? "is-active" : ""} />)}
      <span>Desliza para ver más</span>
    </div>}
  </section>;
}
