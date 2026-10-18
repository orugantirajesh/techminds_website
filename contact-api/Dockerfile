# Contact form mail sender. Standard library only — no third-party packages.
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

WORKDIR /app
COPY app.py .
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER 65534:65534
EXPOSE 8080
CMD ["python", "app.py"]
