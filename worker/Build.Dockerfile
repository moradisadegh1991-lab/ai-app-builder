FROM node:22-bookworm-slim
# Trusted server scripts are mounted read-only by the worker; project tools are local dependencies.
