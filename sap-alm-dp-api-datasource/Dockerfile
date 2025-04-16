#docker image build -t alm_plugin_builder:1.0 -f Dockerfile --build-arg NODE_VERSION=20 .
FROM ubuntu:24.04
LABEL version=1.0
ARG NODE_VERSION=20

# Update environment and install necessary tools
RUN apt update && apt install -y \
    bash \
    git \
    curl \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /github
VOLUME /github
RUN git clone https://github.com/SAP/alm-plug-in-for-grafana.git /github

# install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
# set env
ENV NVM_DIR=/root/.nvm
# install node
RUN bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION"
# set ENTRYPOINT for reloading nvm-environment
ENTRYPOINT ["bash", "-c", "source $NVM_DIR/nvm.sh && exec \"$@\"", "--"]

RUN npm install --global yarn@1.22.22

# set cmd to bash
CMD ["/bin/bash"]
