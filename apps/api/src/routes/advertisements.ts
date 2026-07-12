import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const advertisementSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(180).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  actionLabel: z.string().trim().max(30).optional().nullable(),
  actionUrl: z.string().url().optional().nullable(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f97316"),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  displayOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const advertisementsRouter = Router();

advertisementsRouter.get("/", async (_req, res) => {
  res.json(await prisma.advertisement.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }));
});

advertisementsRouter.get("/manage", authenticate, authorize("ADMIN"), async (_req, res) => {
  res.json(await prisma.advertisement.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }));
});

advertisementsRouter.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  const advertisement = await prisma.advertisement.create({ data: advertisementSchema.parse(req.body) });
  res.status(201).json(advertisement);
});

advertisementsRouter.patch("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  const advertisement = await prisma.advertisement.update({ where: { id: req.params.id }, data: advertisementSchema.partial().parse(req.body) });
  res.json(advertisement);
});

advertisementsRouter.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.advertisement.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
