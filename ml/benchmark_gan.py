import time
import numpy as np
import pandas as pd

def unvectorized(close_prices, horizon_days):
    target_returns = np.zeros(len(close_prices))
    for idx in range(len(close_prices) - horizon_days):
        target_returns[idx] = (
            close_prices[idx + horizon_days] - close_prices[idx]
        ) / close_prices[idx]
    return target_returns

def vectorized(close_prices, horizon_days):
    target_returns = np.zeros(len(close_prices))
    valid_end = len(close_prices) - horizon_days
    if valid_end > 0:
        target_returns[:valid_end] = (close_prices[horizon_days:] - close_prices[:-horizon_days]) / close_prices[:-horizon_days]
    return target_returns

# Generate some dummy data
np.random.seed(42)
N = 1000000
close_prices = np.random.rand(N) * 100 + 10
horizon_days = 30

start = time.perf_counter()
res1 = unvectorized(close_prices, horizon_days)
end_unvec = time.perf_counter()

start2 = time.perf_counter()
res2 = vectorized(close_prices, horizon_days)
end_vec = time.perf_counter()

print(f"Unvectorized time: {end_unvec - start:.6f} s")
print(f"Vectorized time: {end_vec - start2:.6f} s")
print(f"Results equal: {np.allclose(res1, res2)}")
print(f"Speedup: {(end_unvec - start) / (end_vec - start2):.2f}x")
