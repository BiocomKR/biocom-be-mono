{{/*
차트 이름과 버전을 확장
*/}}
{{- define "be-temp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
공통 라벨
*/}}
{{- define "be-temp.labels" -}}
helm.sh/chart: {{ include "be-temp.chart" . }}
{{ include "be-temp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
선택자 라벨
*/}}
{{- define "be-temp.selectorLabels" -}}
app.kubernetes.io/name: {{ .Values.app.name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
풀네임 생성
*/}}
{{- define "be-temp.fullname" -}}
{{- if contains .Values.app.name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Values.app.name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
서비스 계정 이름
*/}}
{{- define "be-temp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "be-temp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}