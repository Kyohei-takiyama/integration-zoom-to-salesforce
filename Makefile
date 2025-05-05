.PHONY: all build login push deploy destroy clean install init plan

# --- 変数 (環境に合わせて変更) ---
AWS_REGION   = ap-northeast-1
APP_NAME     = zoom-salesforce-integration-dev
IMAGE_TAG    = latest
# AWSアカウントIDを自動取得
AWS_ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text)
# ECRリポジトリURLを構築
# (Terraformで定義したリポジトリ名と一致させること)
ECR_REPO_URL := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(APP_NAME)-repo

# --- ターゲット ---

# ローカル依存関係のインストール
install:
	@echo ">>> Installing dependencies..."
	bun install

# TypeScriptをビルド
build-ts: install
	@echo ">>> Building TypeScript..."
	bun run build

# Dockerイメージをビルド
build: build-ts
	@echo ">>> Building Docker image [$(ECR_REPO_URL):$(IMAGE_TAG)]..."
	docker build -t $(ECR_REPO_URL):$(IMAGE_TAG) .

# AWS ECRへログイン
login:
	@echo ">>> Logging in to AWS ECR [Region: $(AWS_REGION)]..."
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

# DockerイメージをECRへプッシュ (ログインが必要)
push: login build
	@echo ">>> Pushing image to ECR [$(ECR_REPO_URL):$(IMAGE_TAG)]..."
	docker push $(ECR_REPO_URL):$(IMAGE_TAG)

# Terraform 初期化 (初回またはプロバイダ変更時に実行)
init:
	@echo ">>> Initializing Terraform..."
	cd terraform && terraform init

# Terraform 実行計画の表示
plan: init
	@echo ">>> Planning Terraform deployment..."
	cd terraform && terraform plan \
		-var="app_name=$(APP_NAME)" \
		-var="aws_region=$(AWS_REGION)" \
		-var="ecr_image_tag=$(IMAGE_TAG)"

# Terraform でAWSリソースをデプロイ (ECRへのイメージプッシュが必要)
deploy: push init
	@echo ">>> Applying Terraform deployment..."
	cd terraform && terraform apply -auto-approve \
		-var="app_name=$(APP_NAME)" \
		-var="aws_region=$(AWS_REGION)" \
		-var="ecr_image_tag=$(IMAGE_TAG)"
	@echo ">>> Deployment complete!"
	@echo ">>> API Gateway Endpoint (if created):"
	@cd terraform && terraform output -raw api_gateway_endpoint || echo "(API Gateway not configured or output not found)"

# 全てを実行 (ビルド -> プッシュ -> デプロイ)
all: deploy

# Terraform で作成したリソースを削除
destroy: init
	@echo ">>> Destroying Terraform resources..."
	cd terraform && terraform destroy -auto-approve \
		-var="app_name=$(APP_NAME)" \
		-var="aws_region=$(AWS_REGION)" \
		-var="ecr_image_tag=$(IMAGE_TAG)"

# ローカルのDockerイメージを削除 (任意)
clean:
	@echo ">>> Cleaning up local Docker image..."
	docker rmi $(ECR_REPO_URL):$(IMAGE_TAG) || true