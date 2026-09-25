# 3C Plus — Modelos de dados

> Gerado automaticamente de `swagger.json` em 2026-09-25 por `gerar-referencia.mjs`. Não edite à mão.
> Endpoints: [API_REFERENCIA.md](API_REFERENCIA.md)

**119 modelos.** Modelos de evento do socket: `BaseEvent`, `AgentEvent`, `CallEvent`, `CallHistoryEvent`,
`SpyEvent`, `ListEvent`, `CallTransferEvent`, `ReachedMaxOnlineAgents` (ver [EVENTOS_SOCKET.md](EVENTOS_SOCKET.md)).

## Índice

[Agent](#agent) · [AgentCampaign](#agentcampaign) · [AgentCampaigns](#agentcampaigns) · [AgentEvent](#agentevent) · [AgentMetrics](#agentmetrics) · [AgentMetricsPerTime](#agentmetricspertime) · [Agents](#agents) · [AgentsStatus](#agentsstatus) · [AgentsStatusMetrics](#agentsstatusmetrics) · [AgentStatistic](#agentstatistic) · [AgentStatistics](#agentstatistics) · [AgentStatisticsByAgent](#agentstatisticsbyagent) · [AgentStatisticsByAgentList](#agentstatisticsbyagentlist) · [AgentStatus](#agentstatus) · [AgentStatusMetrics](#agentstatusmetrics) · [ApplicationVersion](#applicationversion) · [BaseEvent](#baseevent) · [Call](#call) · [Callback](#callback) · [Callbacks](#callbacks) · [CallEvent](#callevent) · [CallHistoryEvent](#callhistoryevent) · [CallHistoryReport](#callhistoryreport) · [CallHistoryReports](#callhistoryreports) · [Calls](#calls) · [CallTransferEvent](#calltransferevent) · [Campaign](#campaign) · [Campaigns](#campaigns) · [CampaignStatistics](#campaignstatistics) · [Companies](#companies) · [Company](#company) · [CompanyRole](#companyrole) · [Criterion](#criterion) · [CriterionData](#criteriondata) · [CriterionList](#criterionlist) · [CriterionLists](#criterionlists) · [Criterions](#criterions) · [DailyFinanceCallStats](#dailyfinancecallstats) · [DailyFinanceStats](#dailyfinancestats) · [DailyFinanceTotalStats](#dailyfinancetotalstats) · [DailyQualificationStats](#dailyqualificationstats) · [DialerCampaign](#dialercampaign) · [DialerCampaigns](#dialercampaigns) · [DialerSettings](#dialersettings) · [Error](#error) · [Extension](#extension) · [Feedback](#feedback) · [Feedbacks](#feedbacks) · [HangupCauseStatistics](#hangupcausestatistics) · [IvrAfterCall](#ivraftercall) · [IvrAfterCallCriteria](#ivraftercallcriteria) · [IvrAfterCallCriterion](#ivraftercallcriterion) · [IvrAfterCallCriterionKey](#ivraftercallcriterionkey) · [IvrAfterCallCriterionKeys](#ivraftercallcriterionkeys) · [IvrAfterCalls](#ivraftercalls) · [LineOfWork](#lineofwork) · [ListEvent](#listevent) · [ListQualificationStatistic](#listqualificationstatistic) · [ListQualificationStatistics](#listqualificationstatistics) · [LoginData](#logindata) · [LoginHistory](#loginhistory) · [MailingData](#mailingdata) · [MailingDelete](#mailingdelete) · [MailingFilePreview](#mailingfilepreview) · [MailingItem](#mailingitem) · [MailingList](#mailinglist) · [MailingListMetrics](#mailinglistmetrics) · [MailingLists](#mailinglists) · [MailingListsMetrics](#mailinglistsmetrics) · [MailingListTotalMetrics](#mailinglisttotalmetrics) · [ManualCall](#manualcall) · [MultipleDailyFinanceStats](#multipledailyfinancestats) · [MultipleDailyQualificationStats](#multipledailyqualificationstats) · [OfficeHour](#officehour) · [OfficeHours](#officehours) · [Promoter](#promoter) · [Qualification](#qualification) · [QualificationList](#qualificationlist) · [QualificationLists](#qualificationlists) · [Qualifications](#qualifications) · [QualificationStatistic](#qualificationstatistic) · [QualificationStatistics](#qualificationstatistics) · [ReachedMaxOnlineAgents](#reachedmaxonlineagents) · [ReceptiveIVR](#receptiveivr) · [ReceptiveIVRList](#receptiveivrlist) · [ReceptiveMetric](#receptivemetric) · [ReceptiveMetricList](#receptivemetriclist) · [ReceptiveNumberSetting](#receptivenumbersetting) · [ReceptiveNumberSettings](#receptivenumbersettings) · [ReceptiveQueue](#receptivequeue) · [ReceptiveQueues](#receptivequeues) · [Role](#role) · [Route](#route) · [Routes](#routes) · [Schedule](#schedule) · [Schedules](#schedules) · [SingleCampaignStatistics](#singlecampaignstatistics) · [SpyEvent](#spyevent) · [Team](#team) · [Teams](#teams) · [TelephonyRate](#telephonyrate) · [TelephonyRates](#telephonyrates) · [TotalCallHistoryReport](#totalcallhistoryreport) · [TotalQualificationStats](#totalqualificationstats) · [TotalReceptiveMetric](#totalreceptivemetric) · [TotalReceptiveMetricList](#totalreceptivemetriclist) · [Ura](#ura) · [UraKey](#urakey) · [UraKeys](#urakeys) · [Uras](#uras) · [User](#user) · [UserData](#userdata) · [Users](#users) · [UsersData](#usersdata) · [UserSettings](#usersettings) · [WorkBreakGroup](#workbreakgroup) · [WorkBreakGroups](#workbreakgroups) · [WorkBreakInterval](#workbreakinterval) · [WorkBreakIntervals](#workbreakintervals)

## Agent

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The agent id |
| `name` | string | The agent name |
| `active` | boolean | True if the agent is active or false otherwise |
| `extension` | [Extension](API_MODELOS.md#extension) |  |
| `profile_url` | string | An api url to retrieve the agent data |

## AgentCampaign

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The campaign id |
| `name` | string | The campaign name |
| `paused` | boolean | If the campaign is paused or not |

## AgentCampaigns

Lista de [AgentCampaign](API_MODELOS.md#agentcampaign).

## AgentEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `agent` | [User](API_MODELOS.md#user) |  |

## AgentMetrics

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | The date when the metric was collected. |
| `speaking` | string | How much time the agent spend speaking in a call. |
| `average` | string | The average time logged in. |
| `total_calls` | integer (int64) | Total count of calls during this period. |
| `calls` | integer (int64) | Count of calls dialed during this period. |
| `manual_calls` | integer (int64) | Count of manual calls during this period. |
| `manual_calls_acw` | integer (int64) | Count of manual calls in acw during this period. |
| `idle` | string | How much time the agent spend in idle. |
| `acw` | string | How much time the agent spend in After Call Work. |
| `manual` | string | How much time the agent spend in manual mode. |
| `manual_acw` | string | How much time the agent spend in After Call Work in manual mode. |
| `manual_calls_calling` | string | How much time the agent spend calling in manual mode. |
| `manual_calls_speaking` | string | How much time the agent spend speaking in manual mode. |
| `manual_calls_made` | string | How much calls the agent made in manual mode. |
| `manual_calls_answered` | string | Of calls made how many were answered in manual mode. |
| `manual_calls_acw_calling` | string | How much time the agent spend calling in After Call Work in manual mode. |
| `manual_calls_acw_speaking` | string | How much time the agent spend speaking in After Call Work in manual mode. |
| `manual_calls_acw_made` | string | How much calls the agent made in After Call Work in manual mode. |
| `manual_calls_acw_answered` | string | Of calls made how many were answered in After Call Work in manual mode. |
| `agent` | [Agent](API_MODELOS.md#agent) |  |

## AgentMetricsPerTime

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | The date when the metric was collected. |
| `speaking` | string | How much time the agent spend speaking in a call. |
| `idle` | string | How much time the agent spend in idle. |
| `acw` | string | How much time the agent spend in After Call Work. |
| `manual` | string | How much time the agent spend in manual mode. |
| `manual_acw` | string | How much time the agent spend in After Call Work in manual mode. |
| `interval` | string | How much time the agent spend in Interval. |

## Agents

Lista de [Agent](API_MODELOS.md#agent).

## AgentsStatus

Lista de [AgentStatus](API_MODELOS.md#agentstatus).

## AgentsStatusMetrics

Lista de [AgentStatusMetrics](API_MODELOS.md#agentstatusmetrics).

## AgentStatistic

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | Agent statistics aggregation date using Y-m-d H:i:s format |
| `converted` | integer | Total converted calls |
| `dmc` | integer | Total Decision Maker Contact (DMC) calls |
| `answered` | integer | Total answered calls |

## AgentStatistics

Lista de [AgentStatistic](API_MODELOS.md#agentstatistic).

## AgentStatisticsByAgent

| Campo | Tipo | Descrição |
|---|---|---|
| `agent` | [Agent](API_MODELOS.md#agent) |  |
| `converted` | integer | Total converted calls |
| `dmc` | integer | Total Decision Maker Contact (DMC) calls |
| `answered` | integer | Total answered calls |

## AgentStatisticsByAgentList

Lista de [AgentStatisticsByAgent](API_MODELOS.md#agentstatisticsbyagent).

## AgentStatus

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The agent id |
| `name` | string | The agent name |
| `extension` | integer (int64) | The agent extension number |
| `status` | string | The agent status |
| `status_start_time` | integer (int64) | A timestamp indicating the time when the agent entered the actual status |
| `count` | integer (int64) | The amount of finished calls |
| `total_time` | integer (int64) | The amount of time in seconds for all finished calls |
| `average` | string | The average time in mm:ss format |

## AgentStatusMetrics

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The agent id |
| `name` | string | The agent name |
| `extension` | integer (int64) | The agent extension number |
| `logged_campaign` | integer (int64) | The campaign id |
| `status` | integer (int64) | The agent status |
| `metrics` | object |  |

## ApplicationVersion

| Campo | Tipo | Descrição |
|---|---|---|
| `tag` | string | The last application tag |
| `commit` | string | The commit hash |
| `commit_date` | string | The commit date |

## BaseEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. |
| `company` | [Company](API_MODELOS.md#company) |  |

## Call

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The call id |
| `phone` | string | The phone number. |
| `mode` | string | A string describing the mode of this call. E.g: manual, dialer |
| `agent` | [User](API_MODELOS.md#user) |  |
| `campaign` | [Campaign](API_MODELOS.md#campaign) |  |

## Callback

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The campaign id |
| `did` | string | The did number |
| `company` | [Company](API_MODELOS.md#company) |  |
| `mailingList` | [MailingList](API_MODELOS.md#mailinglist) |  |
| `campaign` | [Campaign](API_MODELOS.md#campaign) |  |

## Callbacks

Lista de [Callbacks](API_MODELOS.md#callbacks).

## CallEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `call` | [Call](API_MODELOS.md#call) |  |

## CallHistoryEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `call` | [CallHistoryReport](API_MODELOS.md#callhistoryreport) |  |

## CallHistoryReport

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | The call id |
| `list` | string | The list name |
| `number` | string | The phone number |
| `call_date` | string | The date of this call |
| `call_date_rfc3339` | string | The call date in RFC3339 format. |
| `campaign_id` | integer | The campaign id |
| `campaign` | string | The campaign name |
| `queue_name` | string | The queue name |
| `has_agent` | boolean | If the call has a agent |
| `agent` | string | The agent name |
| `acw_time` | string | The time spend by the agent after a call. |
| `speaking_time` | string | The speaking time |
| `speaking_with_agent_time` | string | The time spend by the agent speaking with the client. |
| `route` | object |  |
| `ivr_time` | string | The ivr time |
| `billed_time` | string | The billed time |
| `billed_value` | string | The billed value |
| `qualification` | integer (int64) | The qualification id |
| `behavior` | integer (int64) | The behavior id |
| `readable_behavior_text` | string | The readable behavior text |
| `phone_type` | string | Either mobile or landline |
| `recording` | string | The url of the recorded call |
| `recording_amd` | string | The url of the recorded amd call |
| `status_id` | string | The status id |
| `readable_status_text` | string | The readable status text |
| `readable_amd_status_text` | string | The amd status text string |
| `mode` | string | The call mode |
| `hangup_cause` | string | The hangup cause code |
| `readable_hangup_cause_text` | string | The hangup cause text string |
| `recorded` | boolean | If the call was recorded |
| `ended_by_agent` | boolean | If the call was ended by the agent |
| `qualification_note` | boolean | The note the agent left at the call when was qualifying |
| `sid` | string | A human readable string identifier which is unique per call. |
| `is_dmc` | boolean | if the call was qualified as decision maker contact (DMC). |
| `is_transferred` | boolean | If the call was transferred |
| `is_consult` | boolean | If the call is a consult (warm transfer) |
| `is_transfer` | boolean | If the call is a transfer |
| `consults` | lista de string | An array with consults (warm transfer) generated by this call. |
| `consult_ids` | object |  |
| `parent` | string | The url to the parent call, if it's a call transfer or call consult (warm transfer). |
| `parent_id` | string | The sid to the parent call, if it's a call transfer or call consult (warm transfer). |
| `transfer` | string | The url to the transfer call |
| `transfer_id` | string | The sid to the transfer call |
| `consult` | string | The url to the consult call (warm transfer) |
| `consult_id` | string | The sid to the consult call (warm transfer) |
| `recording_transfer` | string | Download a call recording for the transfer portion of the call |
| `recording_consult` | string | Download a call recording for the consult (warm transfer) portion of the call |
| `mailing_data` | [MailingData](API_MODELOS.md#mailingdata) |  |
| `feedback` | [Feedback](API_MODELOS.md#feedback) |  |

## CallHistoryReports

Lista de [CallHistoryReport](API_MODELOS.md#callhistoryreport).

## Calls

Lista de [Call](API_MODELOS.md#call).

## CallTransferEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `call` | [Call](API_MODELOS.md#call) |  |
| `agent` | [Agent](API_MODELOS.md#agent) |  |
| `consultant` | [Agent](API_MODELOS.md#agent) |  |
| `consultedQueue` | [ReceptiveQueue](API_MODELOS.md#receptivequeue) |  |

## Campaign

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The campaign id |
| `name` | string | The campaign name |
| `start_time` | string | The campaign start time |
| `end_time` | string | The campaign end time |
| `paused` | boolean | True if the campaign is paused, otherwise false |
| `acw_timeout` | integer (int64) | The campaign's acw timeout in seconds, 0 means no timeout. |
| `limit_call_time` | integer (int64) | Limit call time. |
| `is_on_active_time` | boolean | True if the campaign is on it's active time, otherwise false. |
| `caller_id` | string | The campaign caller id |
| `asr` | number (float) | The campaign asr |
| `amd_enabled` | boolean | True if amd is enabled, false disabled |
| `copy_identifier` | boolean | If true, copy the identifier of the connected call |
| `company` | [Company](API_MODELOS.md#company) |  |
| `extension` | [Extension](API_MODELOS.md#extension) |  |
| `dialer_settings` | [DialerSettings](API_MODELOS.md#dialersettings) |  |
| `route_landline` | [Route](API_MODELOS.md#route) |  |
| `route_mobile` | [Route](API_MODELOS.md#route) |  |
| `work_break_group` | [WorkBreakGroup](API_MODELOS.md#workbreakgroup) |  |
| `limit_call_per_agent` | number (float) | The call limit per agent |

## Campaigns

Lista de [Campaign](API_MODELOS.md#campaign).

## CampaignStatistics

| Campo | Tipo | Descrição |
|---|---|---|
| `data` | lista de [SingleCampaignStatistics](API_MODELOS.md#singlecampaignstatistics) |  |

## Companies

Lista de [Company](API_MODELOS.md#company).

## Company

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The company id |
| `name` | string | The company name |
| `currency` | string | The company default currency format |
| `balance` | number (float) | The company balance |
| `domain` | string | The company subdomain |
| `logo_name` | string | The company logo |
| `logo_image_link` | string | The url for the company logo |
| `socket_channel` | string | The company socket channel that will be used to listen for events |
| `users` | [Users](API_MODELOS.md#users) |  |

## CompanyRole

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The company role id. |
| `name` | string | The company role name. |

## Criterion

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The criterion id |
| `name` | string | The criterion name |
| `description` | string | The criterion description |
| `color` | string | The criterion color |
| `emoji` | string | The criterion emoji |

## CriterionData

_Sem campos declarados._

## CriterionList

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The criterion list id |
| `name` | string | The criterion list name |

## CriterionLists

Lista de [CriterionList](API_MODELOS.md#criterionlist).

## Criterions

Lista de [Criterion](API_MODELOS.md#criterion).

## DailyFinanceCallStats

| Campo | Tipo | Descrição |
|---|---|---|
| `calls` | integer (int64) | The number of calls of this type on this day |
| `speaking_time` | integer (int64) | The sum of the calls speaking time on this day |
| `billed_time` | number (double) | The sum of the calls billed time on this day |
| `billed_value` | number (double) | The sum of the calls billed value on this day |
| `bill_value` | number (double) | The bill value for calls on this day |

## DailyFinanceStats

| Campo | Tipo | Descrição |
|---|---|---|
| `company_id` | integer (int64) | The company id |
| `date` | string | The report date in Y-m-d format |
| `landline` | [DailyFinanceCallStats](API_MODELOS.md#dailyfinancecallstats) |  |
| `mobile` | [DailyFinanceCallStats](API_MODELOS.md#dailyfinancecallstats) |  |
| `total` | [DailyFinanceTotalStats](API_MODELOS.md#dailyfinancetotalstats) |  |

## DailyFinanceTotalStats

| Campo | Tipo | Descrição |
|---|---|---|
| `speaking_time` | integer (int64) | The sum of the speaking time for all calls on this day |
| `billed_time` | number (double) | The sum of the billed time for all calls on this day |
| `billed_value` | number (double) | The sum of the billed value for all calls on this day |

## DailyQualificationStats

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | The date in Y-m-d format |
| `calls` | integer (int64) | The number of calls on this day |
| `qualifications` | lista de string | An array of qualification ids |

## DialerCampaign

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The campaign id |
| `url` | string | The campaign url |
| `wait_time` | string | The campaign wait time |
| `call_time` | string | The campaign call time |
| `recalls` | integer (int64) | The campaign's recall count |
| `acw_time` | string | The campaign acw time |
| `start_time` | string | The campaign start time |
| `end_time` | string | The campaign end time |
| `acw_timeout` | integer (int64) | The campaign's acw timeout in seconds, 0 means no timeout. |
| `company` | [Company](API_MODELOS.md#company) |  |
| `extension` | [Extension](API_MODELOS.md#extension) |  |

## DialerCampaigns

Lista de [DialerCampaign](API_MODELOS.md#dialercampaign).

## DialerSettings

| Campo | Tipo | Descrição |
|---|---|---|
| `url` | string | The dialer url |

## Error

| Campo | Tipo | Descrição |
|---|---|---|
| `status_code` | integer (int32) |  |
| `title` | string |  |
| `detail` | string |  |

## Extension

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The extension id |
| `extension_number` | integer (int64) | The extension number |
| `type` | integer (int64) | The extension type |

## Feedback

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | The feedback id |
| `call_history_id` | string | The Call History Id for Feedback |
| `campaign_id` | integer (int64) | The feedbacks's campaign id |
| `company_id` | integer (int64) | The feedbacks's company id |
| `agent_id` | integer (int64) | The agent who receives the feedback |
| `manager_id` | integer (int64) | The manager that gives the feedback |
| `criterion_json` | lista de [CriterionData](API_MODELOS.md#criteriondata) | The list of criterion used by the campaign |
| `comment` | string | The comment it self |

## Feedbacks

Lista de [Feedback](API_MODELOS.md#feedback).

## HangupCauseStatistics

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | The start timestamp of the statistics snapshot. |
| `route_id` | integer | The route id |
| `success` | boolean | Call status |
| `hangup_causes` | object | Count of each hangup cause occurrence in time interval as key: value |

## IvrAfterCall

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The ivr after call id |
| `name` | string | The ivr after call name |
| `audio_start` | string | The audio sart |
| `original_audio_name_start` | string | The original audio start name |
| `audio_null_key` | string | The audio null key name |
| `original_audio_name_null_key` | string | The original audio null key name |
| `audio_invalid_key` | string | The audio invalid key name |
| `original_audio_name_invalid_key` | string | The original audio invalid key name |
| `audio_end` | string | The audio end name |
| `original_audio_name_end` | string | The original audio end name |
| `max_wait_time` | integer | The max wait time |
| `attempt_number` | integer | The attempt number |
| `criterion` | lista de [IvrAfterCallCriterion](API_MODELOS.md#ivraftercallcriterion) |  |

## IvrAfterCallCriteria

Lista de [IvrAfterCallCriterion](API_MODELOS.md#ivraftercallcriterion).

## IvrAfterCallCriterion

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The ivr after call criterion id |
| `name` | string | The name criterion |
| `audio` | string | The audio name |
| `original_audio_name` | string | The original audio name |
| `keys` | lista de [IvrAfterCallCriterionKey](API_MODELOS.md#ivraftercallcriterionkey) |  |

## IvrAfterCallCriterionKey

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The ivr after call criterion key id |
| `key` | string | The key to evaluation |

## IvrAfterCallCriterionKeys

Lista de [IvrAfterCallCriterionKey](API_MODELOS.md#ivraftercallcriterionkey).

## IvrAfterCalls

Lista de [IvrAfterCall](API_MODELOS.md#ivraftercall).

## LineOfWork

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The line of work id. |
| `name` | string | The line of work name. |

## ListEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `list` | [MailingList](API_MODELOS.md#mailinglist) |  |

## ListQualificationStatistic

| Campo | Tipo | Descrição |
|---|---|---|
| `list` | object |  |
| `import_date` | string | import list date, format  Y-m-d H:i:s |
| `campaign_id` | integer (int64) | The campaign id |
| `qualifications` | lista de object |  |

## ListQualificationStatistics

Lista de [ListQualificationStatistic](API_MODELOS.md#listqualificationstatistic).

## LoginData

| Campo | Tipo | Descrição |
|---|---|---|
| `login` | string | The date the agent logged in d/m/Y H:i:s format |
| `logout` | string | The date the agent logged out d/m/Y H:i:s format (Return '-' if the agent is still logged in) |
| `agent` | [Agent](API_MODELOS.md#agent) |  |
| `campaign` | [Campaign](API_MODELOS.md#campaign) |  |

## LoginHistory

Lista de [LoginData](API_MODELOS.md#logindata).

## MailingData

Optional mailing data

_Sem campos declarados._

## MailingDelete

| Campo | Tipo | Descrição |
|---|---|---|
| `phone` * | string | The phone number |
| `identifier` | string | The mailing identifier |

## MailingFilePreview

| Campo | Tipo | Descrição |
|---|---|---|
| `file_name` | string | Uploaded file name |
| `original_name` | string | Original file name |
| `header` | lista de string |  |
| `data` | lista de lista de string |  |

## MailingItem

| Campo | Tipo | Descrição |
|---|---|---|
| `phone` * | string | The phone number |
| `identifier` | string | The mailing identifier |
| `data` | [MailingData](API_MODELOS.md#mailingdata) |  |

## MailingList

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The list id |
| `name` | string | The list name |
| `dial` | integer (int64) | The total phones to dial on this list |
| `redial` | integer (int64) | The total phones to redial on this list |
| `dialed` | integer (int64) | The total phones dialed on this list |
| `dialed_percentage` | number (float) | The percentage of dialed phones based on total. |
| `completed` | integer (int64) | The total calls completed on this list |
| `completed_percentage` | number (float) | The percentage of completed calls on this list. |
| `total` | integer (int64) | The total phones of this list |
| `answered` | integer (int64) | The number of calls answered on this list |
| `abandoned` | integer (int64) | The number of calls abandoned on this list |
| `asr` | number (float) | The asr of this list |
| `asr_percentage` | number (float) | The asr percentage in this list. |
| `answered_percentage` | number (float) | The answered percentage in this list. |
| `weight` | integer (int64) | The list weight in campaign. |
| `weight_percentage` | number (float) | The list weight percentage in the campaign. |
| `dial_percentage` | number (float) | The list dial percentage in the campaign. |
| `redial_percentage` | number (float) | The list redial percentage in the campaign. |
| `created_at` | string | The date when the list was created in 'Y-m-d H:i:s' format. |

## MailingListMetrics

| Campo | Tipo | Descrição |
|---|---|---|
| `list` | object |  |
| `phones` | object |  |
| `calls` | object |  |
| `connected` | object |  |

## MailingLists

Lista de [MailingList](API_MODELOS.md#mailinglist).

## MailingListsMetrics

Lista de [MailingListMetrics](API_MODELOS.md#mailinglistmetrics).

## MailingListTotalMetrics

| Campo | Tipo | Descrição |
|---|---|---|
| `phones` | object |  |
| `calls` | object |  |
| `connected` | object |  |

## ManualCall

| Campo | Tipo | Descrição |
|---|---|---|
| `call` | object |  |
| `agent` | object |  |

## MultipleDailyFinanceStats

Lista de [DailyFinanceStats](API_MODELOS.md#dailyfinancestats).

## MultipleDailyQualificationStats

Lista de [DailyQualificationStats](API_MODELOS.md#dailyqualificationstats).

## OfficeHour

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The office hours id |
| `name` | string | The office hours name |
| `audio` | string | The audio name |
| `original_audio_name` | string | The original audio name |
| `day_week` | lista de integer | The array with all days of week |
| `start_time` | lista de string | The array with all start time |
| `end_time` | lista de string | The array with all end time |

## OfficeHours

Lista de [OfficeHours](API_MODELOS.md#officehours).

## Promoter

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The promoter id. |
| `name` | string | The promoter name. |

## Qualification

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The qualification id |
| `name` | string | The qualification name |
| `behavior` | integer (int64) | The qualification behavior code |
| `readable_behavior` | string | A readable string for the behavior code |
| `color` | string | The qualification color |
| `emoji` | string | The qualification emoji |
| `conversion` | boolean | If the qualification is a conversion |
| `allow_schedule` | boolean | If the qualification allow to schedule a call |
| `allow_schedule_to_another_number` | boolean | If the qualification allow to schedule a call to different number |
| `days_limit` | boolean | Days limit to schedule a call |
| `should_insert_blacklist` | boolean | Add number to blacklist |

## QualificationList

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The qualification list id |
| `name` | string | The qualification list name |
| `campaigns` | [DialerCampaigns](API_MODELOS.md#dialercampaigns) |  |

## QualificationLists

Lista de [QualificationList](API_MODELOS.md#qualificationlist).

## Qualifications

Lista de [Qualification](API_MODELOS.md#qualification).

## QualificationStatistic

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | Agent statistics aggregation date using Y-m-d H:i:s format |
| `qualifications` | lista de object |  |

## QualificationStatistics

Lista de [QualificationStatistic](API_MODELOS.md#qualificationstatistic).

## ReachedMaxOnlineAgents

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |

## ReceptiveIVR

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The Receptive IVR id |
| `name` | string | The Receptive IVR name |
| `timeout` | integer (int64) | The Receptive IVR timeout |
| `audio_path` | string | The Receptive IVR audio path |
| `redirect` | [ReceptiveQueue](API_MODELOS.md#receptivequeue) | The Receptive IVR default redirect |
| `keys` | lista de object | The keys from receptive IVR |

## ReceptiveIVRList

Lista de [ReceptiveIVR](API_MODELOS.md#receptiveivr).

## ReceptiveMetric

| Campo | Tipo | Descrição |
|---|---|---|
| `abandoned` | integer (int64) | Total abandoned calls. |
| `connected` | integer (int64) | Total connected calls. |
| `waiting_time` | integer (int64) | Total waiting time. |
| `speaking` | integer (int64) | Total speaking time. |
| `speaking_with_agent` | integer (int64) | Total speaking with agent time. |
| `acw` | integer (int64) | Total acw time. |
| `date` | string | The date of this metric |
| `queue_id` | integer (int64) | Total abandoned calls. |

## ReceptiveMetricList

Lista de [ReceptiveMetric](API_MODELOS.md#receptivemetric).

## ReceptiveNumberSetting

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The Receptive queue id |
| `name` | string | The Receptive name |
| `did` | string | The Receptive did |
| `receptive_ivr` | [ReceptiveIVR](API_MODELOS.md#receptiveivr) |  |
| `receptive_queue` | [ReceptiveQueue](API_MODELOS.md#receptivequeue) |  |

## ReceptiveNumberSettings

Lista de [ReceptiveNumberSetting](API_MODELOS.md#receptivenumbersetting).

## ReceptiveQueue

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The Receptive queue id |
| `name` | string | The Receptive queue name |
| `wait_time` | integer (int64) | The Receptive queue wait time |
| `acw_timeout` | integer (int64) | The acw timeout |
| `priority` | integer (int64) | The queue priority |
| `qualification_list_id` | integer (int64) | The qualification list id |
| `audio_path` | string | The Receptive queue audio path |
| `limit_call_time` | integer (int64) | Limit call time |
| `ivr_after_call_id` | integer | The ivr after call id |
| `extension` | [Extension](API_MODELOS.md#extension) |  |
| `agents` | lista de [Agent](API_MODELOS.md#agent) | The agents from receptive queue |

## ReceptiveQueues

Lista de [ReceptiveQueue](API_MODELOS.md#receptivequeue).

## Role

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The role id |
| `name` | string | The role name |
| `readable_name` | string | The role readable name |

## Route

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The route id |
| `name` | string | The route name |
| `endpoint` | string | The endpoit |
| `route` | string | The route |
| `uses_country_code` | string | User country code |
| `allow_mobile` | boolean | If the route allow calls to mobile phones |
| `allow_landline` | boolean | If the route allow calls to landline phones |
| `telephony-rates` | [TelephonyRates](API_MODELOS.md#telephonyrates) |  |

## Routes

Lista de [Route](API_MODELOS.md#route).

## Schedule

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | The schedule id |
| `date` | string | The scheduled date. 2000-01-30 23:00:00 format |
| `phone` | string | The phone number |
| `note` | string | The note about the schedule |
| `mailing` | [MailingData](API_MODELOS.md#mailingdata) |  |
| `agent` | object |  |
| `campaign` | object |  |
| `agent_rel` | [Agent](API_MODELOS.md#agent) |  |
| `campaign_rel` | [Campaign](API_MODELOS.md#campaign) |  |

## Schedules

Lista de [Schedule](API_MODELOS.md#schedule).

## SingleCampaignStatistics

| Campo | Tipo | Descrição |
|---|---|---|
| `date` | string | The timestamp of the statistics snapshot. |
| `not_answered` | integer | Amount of not answered calls |
| `answered` | integer | Amount of answered calls |
| `abandoned` | integer | Amount of abandoned calls |
| `abandoned_due_amd` | integer | Amount of abandoned_due_amd calls |
| `failed` | integer | Amount of failed calls |

## SpyEvent

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | The name of the event. _(de BaseEvent)_ |
| `company` | [Company](API_MODELOS.md#company) |  _(de BaseEvent)_ |
| `spy` | [User](API_MODELOS.md#user) |  |
| `spied` | [User](API_MODELOS.md#user) |  |

## Team

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The team id |
| `name` | string | The team name |
| `color` | string | The team color |
| `agents` | lista de [User](API_MODELOS.md#user) | The array with all agents on the team |
| `supervisor` | lista de [User](API_MODELOS.md#user) | The array with all supervisors on the team |

## Teams

Lista de [Team](API_MODELOS.md#team).

## TelephonyRate

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The telephony rate id |
| `minimum_duration` | integer | The minimum duration |
| `minimum_duration_charged` | integer | The minimum duration charged |
| `cadence` | integer | The cadence |
| `type` | integer | The type |
| `value` | integer (float) | The value |

## TelephonyRates

Lista de [TelephonyRate](API_MODELOS.md#telephonyrate).

## TotalCallHistoryReport

| Campo | Tipo | Descrição |
|---|---|---|
| `all` | object |  |
| `mobile` | object |  |
| `landline` | object |  |

## TotalQualificationStats

| Campo | Tipo | Descrição |
|---|---|---|
| `calls` | integer (int64) | The number of calls on this day |
| `qualifications` | lista de string | An array with the total of each qualification |

## TotalReceptiveMetric

| Campo | Tipo | Descrição |
|---|---|---|
| `abandoned` | integer (int64) | Total abandoned calls. |
| `connected` | integer (int64) | Total connected calls. |
| `waiting_time` | integer (int64) | Total waiting time. |
| `speaking` | integer (int64) | Total speaking time. |
| `speaking_with_agent` | integer (int64) | Total speaking with agent time. |
| `acw` | integer (int64) | Total acw time. |
| `date` | string | The date of this metric |

## TotalReceptiveMetricList

Lista de [TotalReceptiveMetric](API_MODELOS.md#totalreceptivemetric).

## Ura

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The ura id |
| `name` | string | The ura name |
| `audio` | string | The audio name |
| `original_audio_name` | string | The original audio name |
| `wait_time` | integer | The wait time |
| `keys` | lista de [UraKey](API_MODELOS.md#urakey) |  |

## UraKey

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The ura id |
| `key` | string | The key to transfer to the campaign |

## UraKeys

Lista de [UraKeys](API_MODELOS.md#urakeys).

## Uras

Lista de [Ura](API_MODELOS.md#ura).

## User

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The user id |
| `name` | string | The user name |
| `email` | string | The user email |
| `active` | integer (int32) | 0 or 1 representing if an user is active or inactive |
| `api_token` | string | The user's token to make requests for the api |
| `confirmed` | integer (int32) | 0 or 1 representing if an user is confirmed or not |
| `confirmation_code` | string | The user's confirmation code |
| `extension_password` | string | The user's extension password |
| `telephony_id` | string | The user's telephony id. |
| `webphone` | boolean | If the user has access to web phone extension |
| `user_document` | string | The user CPF |
| `extension` | [Extension](API_MODELOS.md#extension) |  |
| `role` | [Role](API_MODELOS.md#role) |  |
| `settings` | [UserSettings](API_MODELOS.md#usersettings) |  |
| `teams` | [Teams](API_MODELOS.md#teams) |  |
| `campaigns` | [Campaigns](API_MODELOS.md#campaigns) |  |
| `receptive_queues` | [ReceptiveQueues](API_MODELOS.md#receptivequeues) |  |

## UserData

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The user data id. |
| `name` | string | The user data name. |
| `email` | string | The user data email. |
| `whatsapp_number` | string | The user data whatsapp number. |
| `line_of_work` | [LineOfWork](API_MODELOS.md#lineofwork) |  |
| `company_role` | [CompanyRole](API_MODELOS.md#companyrole) |  |
| `promoter` | [Promoter](API_MODELOS.md#promoter) |  |

## Users

Lista de [User](API_MODELOS.md#user).

## UsersData

Lista de [UserData](API_MODELOS.md#userdata).

## UserSettings

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The settings id |
| `timezone` | string | The user timezone |
| `language` | string | The user language |
| `date_format` | string | A valid date format e.g d/m/Y, Y/m/d, d-m-y |
| `hour_format` | string | A valid date format e.g H:i, H:i:s, h:i |
| `web_extension` | boolean | True if the web extension is enabled otherwise false |

## WorkBreakGroup

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The work break group id |
| `name` | string | The work break group name |

## WorkBreakGroups

Lista de [WorkBreakGroup](API_MODELOS.md#workbreakgroup).

## WorkBreakInterval

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (int64) | The work break interval id |
| `name` | string | The work break interval name |
| `minutes` | integer (int64) | The work break interval minutes |
| `color` | string | The work break interval color |

## WorkBreakIntervals

Lista de [WorkBreakInterval](API_MODELOS.md#workbreakinterval).
