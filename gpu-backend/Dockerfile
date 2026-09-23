# Roksal GPU backend — Qwen-Image-Edit-2509 (S+6)
# Zgradi in poženi SAMO na stroju z NVIDIA GPU (spec §1: lasten backend, ne Vercel).
# Vercel ostane frontend; GPU servis je samostojen (spec §20 pogodba).
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    QWEN_OUTPUT_DIR=/data/jobs \
    HF_HOME=/data/hf-cache

WORKDIR /srv/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY tests/ ./tests/

# model ~40GB (bf16) se prenese 1× ob prvem zagonu v HF_HOME volume
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
