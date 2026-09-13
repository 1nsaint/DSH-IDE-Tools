# syntax=docker/dockerfile:1.7
# Stock @deepseek-ai/dsh Web UI + Docker CLI for Containers/Database plugins.

ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS installer

ARG DSH_VERSION=0.1.1-rc.2
ARG PNPM_VERSION=10.15.1

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      build-essential \
      ca-certificates \
      python3 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global --omit=dev --no-audit --no-fund \
      --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs \
      "@deepseek-ai/dsh@${DSH_VERSION}" \
      "pnpm@${PNPM_VERSION}" \
    && test "$(dsh --version)" = "${DSH_VERSION}" \
    && npm cache clean --force

FROM ${NODE_IMAGE}

ARG DSH_VERSION=0.1.1-rc.2
ARG PNPM_VERSION=10.15.1
ARG DOCKER_CLI_VERSION=29.5.3
ARG DOCKER_COMPOSE_VERSION=2.40.3

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      ca-certificates \
      curl \
      git \
      procps \
      python3 \
      ripgrep \
      tini \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) docker_arch=x86_64 ;; \
         arm64) docker_arch=aarch64 ;; \
         *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_CLI_VERSION}.tgz" \
      | tar -xz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${docker_arch}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod 0755 /usr/local/bin/docker /usr/local/lib/docker/cli-plugins/docker-compose \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/local/lib/node_modules/@deepseek-ai

COPY --from=installer /usr/local/lib/node_modules/@deepseek-ai/dsh /usr/local/lib/node_modules/@deepseek-ai/dsh
COPY --from=installer /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm

RUN ln -s ../lib/node_modules/@deepseek-ai/dsh/lib/bin.js /usr/local/bin/dsh \
    && ln -s ../lib/node_modules/pnpm/bin/pnpm.cjs /usr/local/bin/pnpm \
    && test "$(dsh --version)" = "${DSH_VERSION}"

ENV DSH_HOME=/home/node/.dsh \
    DSH_TELEMETRY_DISABLED=1 \
    HOME=/workspace \
    NODE_ENV=production \
    XDG_CACHE_HOME=/tmp/.cache \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_DATA_HOME=/tmp/.local/share

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY web.cordis.patch.yml /opt/dsh-ide-tools/web.cordis.patch.yml

RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p "${DSH_HOME}" /workspace \
    && chown -R node:node "${DSH_HOME}" /workspace

USER node
WORKDIR /workspace

EXPOSE 3080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["--profile", "web", "--patch", "/opt/dsh-ide-tools/web.cordis.patch.yml", "--no-open"]
