import type { Request, Response } from 'express';
import { z } from 'zod';
import { modelRepository } from '../models/modelRepository.js';
import { checkModelAvailability } from '../services/modelAvailabilityService.js';
import { SingleAvailabilitySchema } from '../types/availability.js';

export async function handleSingleModelAvailability(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const body = SingleAvailabilitySchema.parse(req.body);
    const model = modelRepository.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const { probe, model: updatedModel } = await checkModelAvailability(model, body.mode, true);

    res.json({
      data: {
        status: probe.status,
        responseMs: probe.responseMs,
        error: probe.error,
        usage: probe.usage,
      },
      model: updatedModel,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Некорректные параметры',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    const message = error instanceof Error ? error.message : 'Ошибка проверки доступности';
    res.status(500).json({ error: message });
  }
}
