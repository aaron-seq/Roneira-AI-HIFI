# Roneira AI HIFI — ML Service

FastAPI service providing stock predictions, PDM strategy signals, and
sentiment analysis.

## Canonical entrypoint

`main.py` (FastAPI, ASGI) — run with `uvicorn main:app`. This is what the
`Dockerfile`, `Procfile`, `railway.json`, and `start.sh` all run; it is the
only entrypoint that should be deployed.

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload   # local dev
```

`app.py` is a separate, older Flask implementation kept **only** because
`test_ml_service.py` and `test_contract_validation.py` exercise it directly
via Flask's test client. It is not deployed anywhere and should not be
extended with new production features — add those to `main.py` instead.

## Dependencies

Single canonical dependency list: `requirements.txt`. `pyproject.toml` reads
its `[project.dependencies]` from that same file (via `dynamic.dependencies`),
so `pip install -r requirements.txt` and `pip install .` always agree.

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Environment variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Matches the Dockerfile/docker-compose port mapping. |
| `ENVIRONMENT` | `production` | Set to `development` to enable uvicorn `--reload` when running via `python main.py`. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins. |
| `ALPHA_VANTAGE_API_KEY` | `demo` | Optional; used by downstream services, not `main.py` directly. |
| `HUGGING_FACE_API_KEY` | unset | Optional, used for sentiment models. |

## Tests

```bash
pytest                 # all tests
pytest --cov=.         # with coverage
pytest -k pdm          # PDM engine tests only
```

## Note on the sibling `ml/` directory

The top-level `ml/` directory (outside `ml-service/`) is a separate, smaller
package used only for offline model training (`train_models.py`) that
produces artifacts consumed by the frontend/backend independently of the
running ML service. It is not an alternate deployment of this service.
