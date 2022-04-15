SHELL:=/bin/bash

.DEFAULT_GOAL := install
.PHONY: bootstrap

export REGION ?= eu-west-1
export PROJECT_NAME ?= BlueprintCdkBackService
export PIPELINE_STACK ?= ${PROJECT_NAME}-Pipeline
export CI ?= false

install:
	yarn install --frozen-lockfile
	yarn bootstrap

build:
	@yarn build

test:
	CI=${CI} yarn test

test-functionality:
	@yarn build
	yarn test-functional

synth:
	@make build
	@cd packages/infra && \
	yarn cdk synth -a bin/infra.js
	
deploy-local:
	@make install
	@make synth
	@cd packages/infra && \
	yarn cdk -a cdk.out/assembly-${PROJECT_NAME} deploy \*

deploy:
	@make install
	@make build
	@cd packages/infra && \
	yarn cdk deploy ${PIPELINE_STACK_NAME}

create-test-user:
	cd packages/data-models && \
	node -e "require('./lib/test-support/auth/auth.helpers').createUserScript()"

generate-sample-data:
	cd packages/rest-api && \
	node -e "require('./scripts/data.generator').generateDevelopmentData('${STACK_NAME}', '${REGION}')"

pre-commit:
	@echo "Running pre-commit" checks
	@make lint
	@make build
	@make test
	@make test-functional
	@make deploy-local