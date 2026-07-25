import type { Request, Response } from 'express';
import { modelRepository } from '../models/modelRepository.js';
import { modelRatingRepository } from '../models/modelRatingRepository.js';
import { runModelBenchmark } from '../services/modelAutoEvalService.js';

export async function handleSingleModelEvaluation(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const model = modelRepository.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const outcome = await runModelBenchmark(model);
    const chatRating = modelRatingRepository.getAverageScore(model.id);

    res.json({
      data: outcome.evaluation
        ? {
          ok: outcome.evaluation.ok,
          total: outcome.evaluation.total,
          score: outcome.evaluation.score,
          breakdown: outcome.evaluation.breakdown,
          errors: outcome.evaluation.errors,
          responseMs: outcome.responseMs,
          status: outcome.status,
        }
        : {
          ok: false,
          total: outcome.rating?.score ? undefined : 0,
          score: outcome.rating?.score,
          errors: outcome.error ? [outcome.error] : [],
          responseMs: outcome.responseMs,
          status: outcome.status,
        },
      rating: outcome.rating,
      model: {
        ...outcome.model,
        chat_rating_avg: chatRating,
        chat_rating_count: modelRatingRepository.findByModelId(model.id).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка автооценки';
    res.status(500).json({ error: message });
  }
}
