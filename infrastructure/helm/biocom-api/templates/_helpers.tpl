{{/*
차트 이름과 버전을 확장
*/}}
{{- define "biocom-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
공통 라벨
*/}}
{{- define "biocom-api.labels" -}}
helm.sh/chart: {{ include "biocom-api.chart" . }}
{{ include "biocom-api.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
선택자 라벨
*/}}
{{- define "biocom-api.selectorLabels" -}}
app.kubernetes.io/name: {{ .Values.app.name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
풀네임 생성
*/}}
{{- define "biocom-api.fullname" -}}
{{- if contains .Values.app.name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Values.app.name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
서비스 계정 이름
*/}}
{{- define "biocom-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "biocom-api.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}