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

    def combine(
        self,
        predictions: list[dict],
        weights: list[float] | None = None,
        names: list[str] | None = None,
    ) -> dict:
        """
        Combine predictions from multiple models.

        Args:
            predictions: List of prediction dicts (each from a different model)
            weights: Optional weights for each model. If None, uses confidence-based weighting.
            names: Optional model labels, used to report the per-model breakdown in
                `components`. Callers should pass these: the blended number alone
                hides whether the models agreed, and how much they disagreed is
                the more honest signal to surface.
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

        labels = names or [f"model_{i}" for i in range(n)]

        # Per-model breakdown. The blended price hides disagreement, which is the
        # part a reader actually needs: four models clustered tightly is a very
        # different claim from four models scattered across a 10% range.
        components = [
            {
                "name": label,
                "predicted_price": round(float(p.get("predicted_price", 0)), 2),
                "confidence": round(float(p.get("confidence", 50)), 1),
                "weight": round(float(w), 3),
                "signal": p.get("short_term_signal", {}).get("signal", "HOLD"),
                "fallback": bool(p.get("fallback", False)),
            }
            for label, p, w in zip(labels, predictions, weights)
        ]

        return {
            "predicted_price": round(predicted_price, 2),
            "confidence": round(confidence, 1),
            "confidence_breakdown": confidence_breakdown,
            "short_term_signal": {"signal": best_signal, "score": round(min(10, avg_short_score), 1)},
            "long_term_signal": {"signal": best_signal, "score": round(min(10, avg_long_score), 1)},
            "indicators": all_indicators[:8],
            "ensemble_weights": {label: round(w, 3) for label, w in zip(labels, weights)},
            "agreement_score": round(1 - relative_spread * 10, 3),
            "price_spread": round(float(price_spread), 2),
            "components": components,
        }
