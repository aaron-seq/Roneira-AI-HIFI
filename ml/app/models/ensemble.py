"""
Ensemble Model Combiner
Combines predictions from multiple models using weighted averaging
with confidence-adjusted scoring.
"""
import logging
import numpy as np

logger = logging.getLogger("roneira-ml.ensemble")


class EnsembleCombiner:
    """Combine multiple model predictions into a single weighted prediction."""

    def combine(self, predictions: list[dict], weights: list[float] | None = None) -> dict:
        """
        Combine predictions from multiple models.

        Args:
            predictions: List of prediction dicts (each from a different model)
            weights: Optional weights for each model. If None, uses confidence-based weighting.
        """
        if not predictions:
            return {
                "predicted_price": 0,
                "confidence": 0,
                "indicators": [],
            }

        n = len(predictions)

        if weights is None:
            # Use confidence-based weights
            confidences = [p.get("confidence", 50) for p in predictions]
            total_conf = sum(confidences)
            weights = [c / total_conf for c in confidences] if total_conf > 0 else [1 / n] * n
        else:
            # Normalize weights
            total = sum(weights)
            weights = [w / total for w in weights]

        # Weighted average predicted price
        predicted_price = sum(
            p.get("predicted_price", 0) * w
            for p, w in zip(predictions, weights)
        )

        # Weighted average confidence
        confidence = sum(
            p.get("confidence", 50) * w
            for p, w in zip(predictions, weights)
        )

        # Aggregate confidence breakdown
        breakdown_keys = ["technical", "fundamental", "sentiment", "historical"]
        confidence_breakdown = {}
        for key in breakdown_keys:
            values = [
                p.get("confidence_breakdown", {}).get(key, 50)
                for p in predictions
            ]
            confidence_breakdown[key] = round(sum(v * w for v, w in zip(values, weights)), 1)

        # Aggregate signal (majority vote weighted by confidence)
        signal_scores = {
            "STRONG_BUY": 0, "BUY": 0, "HOLD": 0, "SELL": 0, "STRONG_SELL": 0
        }
        for p, w in zip(predictions, weights):
            st_signal = p.get("short_term_signal", {}).get("signal", "HOLD")
            signal_scores[st_signal] = signal_scores.get(st_signal, 0) + w

        best_signal = max(signal_scores, key=signal_scores.get)  # type: ignore[arg-type]

        # Signal score from weighted average
        short_scores = [
            p.get("short_term_signal", {}).get("score", 5) for p in predictions
        ]
        long_scores = [
            p.get("long_term_signal", {}).get("score", 5) for p in predictions
        ]
        avg_short_score = sum(s * w for s, w in zip(short_scores, weights))
        avg_long_score = sum(s * w for s, w in zip(long_scores, weights))

        # Merge all indicators (deduplicate by name, prefer highest-confidence)
        all_indicators = []
        seen_names = set()
        for p in sorted(predictions, key=lambda x: x.get("confidence", 0), reverse=True):
            for ind in p.get("indicators", []):
                if ind["name"] not in seen_names:
                    all_indicators.append(ind)
                    seen_names.add(ind["name"])

        # Ensemble confidence boost (agreement premium)
        price_spread = np.std([p.get("predicted_price", 0) for p in predictions])
        avg_price = np.mean([p.get("predicted_price", 0) for p in predictions])
        relative_spread = price_spread / avg_price if avg_price > 0 else 1.0

        # Low spread = high agreement = confidence boost
        agreement_bonus = max(0, 5 * (1 - relative_spread * 10))
        confidence = min(95, confidence + agreement_bonus)

        return {
            "predicted_price": round(predicted_price, 2),
            "confidence": round(confidence, 1),
            "confidence_breakdown": confidence_breakdown,
            "short_term_signal": {"signal": best_signal, "score": round(min(10, avg_short_score), 1)},
            "long_term_signal": {"signal": best_signal, "score": round(min(10, avg_long_score), 1)},
            "indicators": all_indicators[:8],
            "ensemble_weights": {f"model_{i}": round(w, 3) for i, w in enumerate(weights)},
            "agreement_score": round(1 - relative_spread * 10, 3),
        }
