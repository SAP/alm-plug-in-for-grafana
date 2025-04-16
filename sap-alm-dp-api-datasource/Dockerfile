#docker image build -t alm_plugin_builder:1.0 -f Dockerfile --build-arg NODE_VERSION=20 .
FROM ubuntu:latest
LABEL version=1.0
ARG NODE_VERSION=20

# Update environment
RUN apt update
RUN apt install -y bash vim git curl npm

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
