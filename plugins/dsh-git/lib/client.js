window.__ModuleLoader__.load({
	id: "dsh-git",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-git";
		const RPC = "/git";
		const STORAGE_PREFIX = "dsh-git.repoPath:";
		const STORAGE_REL_PREFIX = "dsh-git.repoRel:";

		const css = `
.dg_root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base)}
.dg_bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
.dg_meta{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg_select{height:30px;min-width:160px;max-width:320px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12px}
.dg_selectWide{min-width:200px;max-width:420px}
.dg_picker{position:relative;min-width:200px;max-width:420px;flex:0 1 320px}
.dg_pickerBtn{
  width:100%;height:30px;display:flex;align-items:center;gap:6px;padding:0 8px;
  border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;text-align:left;min-width:0
}
.dg_pickerBtn:disabled{opacity:.5;cursor:not-allowed}
.dg_pickerBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dg_pickerLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg_pickerChev{flex:none;opacity:.7;font-size:10px}
.dg_pickerMenu{
  position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:40;
  max-height:min(360px,50vh);overflow:auto;padding:4px;
  border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  box-shadow:0 10px 28px rgba(0,0,0,.4)
}
.dg_pickerEmpty{padding:10px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dg_pickerRow{
  display:flex;align-items:center;gap:4px;width:100%;min-width:0;padding:0;border:0;background:transparent;
  border-radius:6px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px
}
.dg_pickerRow:hover,.dg_pickerRowActive{background:var(--dsw-alias-interactive-bg-hover)}
.dg_pickerExpand{
  flex:none;width:22px;height:26px;border:0;border-radius:4px;background:transparent;
  color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:10px;line-height:1
}
.dg_pickerExpand:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dg_pickerExpandSpacer{flex:none;width:22px;height:26px}
.dg_pickerPick{
  flex:1;min-width:0;height:26px;padding:0 6px;border:0;border-radius:4px;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
}
.dg_pickerSub{padding-left:4px}
.dg_pickerSub .dg_pickerPick{color:var(--dsw-alias-label-secondary);font-size:11px}
.dg_btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}
.dg_btn:disabled{opacity:.5;cursor:not-allowed}
.dg_btnPrimary{background:transparent;color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);border-width:2px}
.dg_btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.dg_body{flex:1;min-height:0;overflow:hidden}
.dg_list{overflow:auto;padding:8px;min-height:0}
.dg_row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:12px;font-family:var(--ds-font-family-code)}
.dg_row:hover,.dg_rowActive{background:var(--dsw-alias-interactive-bg-hover)}
.dg_badge{flex:none;width:28px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dg_diff{overflow:auto;padding:0;margin:0;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.5;background:var(--dsw-alias-bg-base)}
.dg_diffLine{display:block;padding:0 12px;white-space:pre-wrap;word-break:break-word}
.dg_diffAdd{color:#3fb950;background:rgba(63,185,80,.12)}
.dg_diffDel{color:#f85149;background:rgba(248,81,73,.12)}
.dg_diffHunk{color:#79c0ff;background:rgba(56,139,253,.1)}
.dg_diffMeta{color:var(--dsw-alias-label-tertiary)}
.dg_diffEmpty{padding:12px;color:var(--dsw-alias-label-tertiary)}
.dg_statAdd{color:#3fb950}
.dg_statDel{color:#f85149}
.dg_commit{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2)}
.dg_authorPrompt{padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,var(--dsw-alias-bg-layer-1));display:flex;flex-direction:column;gap:8px}
.dg_authorPromptTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_authorPromptHint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.4}
.dg_authorPromptRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dg_authorPromptRow .dg_input{flex:1;min-width:140px;height:30px}
.dg_publish{padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.dg_publishTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_publishHint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.4}
.dg_publishRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dg_publishRow .dg_input{flex:1;min-width:120px;height:30px}
.dg_checkLabel{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}
.dg_modalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
.dg_modal{width:min(520px,100%);max-height:min(80vh,640px);overflow:auto;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 40px rgba(0,0,0,.45);display:flex;flex-direction:column}
.dg_modalHead{padding:14px 16px 8px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_modalBody{padding:0 16px 12px;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.45;display:flex;flex-direction:column;gap:8px}
.dg_modalList{margin:0;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);max-height:220px;overflow:auto;font-family:var(--ds-font-family-code);font-size:11px}
.dg_modalList div{padding:3px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent)}
.dg_modalList div:last-child{border-bottom:none}
.dg_modalActions{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 14px;border-top:1px solid var(--dsw-alias-border-l2)}
.dg_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dg_btnDanger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.dg_btnSm.dg_btnDanger{height:22px}
.dg_banner{padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;line-height:1.4}
.dg_bannerWarn{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary, #d29922) 14%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
.dg_bannerErr{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
.dg_bannerInfo{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,var(--dsw-alias-bg-layer-1))}
.dg_bannerText{flex:1;min-width:180px}
.dg_branchBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.dg_diffPane{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dg_diffToolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:11px;color:var(--dsw-alias-label-tertiary);flex-shrink:0}
.dg_hunkBtn{height:22px;padding:0 8px;font-size:11px;border-radius:4px;margin-left:8px;vertical-align:middle}
.dg_diffLineHunk{display:flex;align-items:center;gap:0;padding:0;background:rgba(56,139,253,.1)}
.dg_diffLineHunk .dg_diffLine{flex:1;min-width:0}
.dg_prBox{padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-layer-1);flex-shrink:0}
.dg_prRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dg_prList{max-height:160px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 8px;background:var(--dsw-alias-bg-base)}
.dg_prItem{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);font-size:12px}
.dg_prItem:last-child{border-bottom:none}
.dg_input{flex:1;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;min-width:0}
.dg_err{color:var(--dsw-alias-state-error-primary);padding:12px 14px;font-size:13px}
.dg_empty{color:var(--dsw-alias-label-tertiary);padding:24px;font-size:13px;line-height:1.5}
.dg_setup{padding:16px 20px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0}
.dg_setup h3{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_setup p{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.45}
.dg_setupRow{display:flex;flex-direction:column;gap:8px}
.dg_setupRow label{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dg_setupActions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dg_hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dg_recent{border-top:1px solid var(--dsw-alias-border-l2);padding:8px 14px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dg_recentTitle{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);margin-bottom:6px}
.dg_recentRow{display:flex;gap:8px;font-family:var(--ds-font-family-code);padding:6px 8px;min-width:0;border-radius:8px;cursor:pointer;align-items:flex-start}
.dg_recentRow:hover,.dg_recentRowActive{background:var(--dsw-alias-interactive-bg-hover)}
.dg_recentHash{flex:none;color:var(--dsw-alias-label-tertiary)}
.dg_recentMsg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg_recentMeta{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:2px}
.dg_history{flex:1;min-height:0;overflow:hidden}
.dg_historyList{overflow:auto;padding:10px 8px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:2px}
.dg_historyList .dg_recentRow{font-family:inherit;padding:10px 12px;border-radius:10px;gap:0}
.dg_historyList .dg_recentRow:hover{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover) 70%,transparent)}
.dg_historyList .dg_recentRowActive{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,var(--dsw-alias-bg-layer-2))}
.dg_historyList .dg_recentMsg{font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;color:var(--dsw-alias-label-secondary);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.dg_historyList .dg_recentRowActive .dg_recentMsg{color:var(--dsw-alias-label-primary);font-weight:600}
.dg_historyList .dg_recentMeta{font-family:var(--ds-font-family-code);font-size:11px;font-weight:400;letter-spacing:0.01em;color:var(--dsw-alias-label-tertiary);margin-top:4px;opacity:.9}
.dg_historyDetail{min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dg_historyHead{padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0}
.dg_historySubject{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0 0 6px;line-height:1.35}
.dg_historyBody{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin:0 0 8px;line-height:1.45}
.dg_historyStats{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code)}
.dg_historySplit{flex:1;min-height:0;overflow:hidden}
.dg_historyFiles{overflow:auto;padding:8px;min-height:0}
@media (max-width:900px){
.dg_history{flex:none;min-height:0}
.dg_historySplit{flex:none;min-height:0}
}
.dg_check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dg_authBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
.dg_modeToggle{display:inline-flex;align-items:stretch;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);overflow:hidden;flex:none}
.dg_modeToggle button{height:100%;margin:0;padding:0 12px;border:none;border-radius:0;border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.dg_modeToggle button:last-child{border-right:none}
.dg_modeToggle button.dg_modeOn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-state-business-primary);font-weight:600}
.dg_modeToggle button:hover:not(:disabled):not(.dg_modeOn){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dg_modeToggle button:disabled{opacity:.45;cursor:not-allowed}
.dg_authOk{color:var(--dsw-alias-state-business-primary)}
.dg_remoteList{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:10px 2px 4px}
.dg_remoteRow{position:relative;display:flex;align-items:center;gap:8px;padding:12px 10px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.dg_remoteRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dg_rowLegend{position:absolute;top:-7px;left:10px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;max-width:calc(100% - 20px);pointer-events:none;z-index:1}
.dg_remoteMeta{flex:1;min-width:0}
.dg_remoteName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg_remoteDesc{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg_pill{flex:none;font-size:9px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-1);line-height:1.25;text-transform:uppercase;letter-spacing:.03em}
.dg_remoteRow:hover .dg_rowLegend .dg_pill{background:var(--dsw-alias-interactive-bg-hover)}
.dg_rowActive .dg_rowLegend .dg_pill{background:var(--dsw-alias-interactive-bg-hover)}
.dg_device{padding:12px 14px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:8px}
.dg_code{font-family:var(--ds-font-family-code);font-size:22px;letter-spacing:.12em;font-weight:700;color:var(--dsw-alias-label-primary)}
.dg_hub{display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;overflow:hidden;padding:12px 16px}
.dg_hubTop{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-end;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0}
.dg_hubTopBlock{display:flex;flex-direction:column;gap:6px;min-width:220px}
.dg_hubTopBlockGrow{flex:1;min-width:min(100%,320px)}
.dg_hubInline{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.dg_hubGrid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.dg_hubColumn{display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}
.dg_hubColumnHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0}
.dg_initBox{flex:none;margin-top:auto;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:8px}
.dg_initRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dg_initRow .dg_select{flex:1;min-width:140px;max-width:none}
.dg_initRow .dg_input{flex:1;min-width:120px;height:30px}
.dg_section{display:flex;flex-direction:column;gap:8px;min-height:0}
.dg_sectionTitle{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_pathHint{font-size:11px;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px}
.dg_localRow{cursor:pointer}
.dg_localRow .dg_btn{cursor:pointer}
.dg_localRow{align-items:flex-start}
.dg_remoteHead{display:flex;align-items:flex-start;gap:8px;width:100%;min-width:0}
.dg_remoteHeadMain{flex:1;min-width:0}
.dg_remoteHead .dg_remoteActions{align-self:flex-start;flex-shrink:0}
.dg_submoduleList{margin-top:6px;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:3px;width:100%;box-sizing:border-box}
.dg_submoduleBlock{margin-top:6px;width:100%;box-sizing:border-box}
.dg_submoduleToggle{
  display:flex;align-items:center;gap:6px;width:100%;padding:4px 6px;margin:0;
  border:0;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;
  cursor:pointer;text-align:left;font-family:inherit;
}
.dg_submoduleToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dg_submoduleToggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#5b9dff);outline-offset:1px}
.dg_submoduleToggleChev{
  flex:none;width:12px;font-size:10px;line-height:1;color:var(--dsw-alias-label-tertiary);
}
.dg_submoduleRow{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:11px}
.dg_submoduleRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dg_submoduleIcon{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);flex:none}
.dg_submoduleMeta{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.dg_submoduleName{font-weight:600;color:var(--dsw-alias-label-primary)}
.dg_submoduleDesc{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);font-size:10px}
.dg_btnSm{height:22px;padding:0 6px;font-size:11px;border-radius:4px}
.dg_submodulesSection{padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:6px}
.dg_submodulesHeader{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em}
.dg_remoteActions{display:flex;align-items:center;gap:6px;flex:none}
.dg_filterInput{width:120px;height:28px;flex:none}
@media (max-width:900px){
.dg_body{flex:none;min-height:0}
.dg_hub{overflow:auto;-webkit-overflow-scrolling:touch}
.dg_hubGrid{grid-template-columns:1fr;flex:none;min-height:0;gap:10px}
.dg_hubColumn{flex:none;min-height:0}
.dg_remoteList{flex:none;max-height:none;overflow:visible}
.dg_hubTopBlock{min-width:0;width:100%}
.dg_hubTopBlockGrow{min-width:0}
.dg_hubColumnHead{gap:6px}
.dg_filterInput{flex:1 1 120px;width:auto;min-width:0}
.dg_remoteRow{flex-wrap:wrap;align-items:flex-start;gap:8px 6px}
.dg_remoteMeta{flex:1 1 100%;min-width:0}
.dg_remoteActions{flex:1 1 auto;justify-content:flex-end;margin-left:auto}
.dg_remoteName{white-space:normal;overflow:visible;text-overflow:unset;display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.3}
.dg_remoteDesc{white-space:normal;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-height:1.35;text-overflow:ellipsis}
.dg_pathHint{max-width:100%}
.dg_submoduleRow{flex-wrap:wrap}
.dg_submoduleMeta{flex:1 1 auto}
}
@media (max-width:480px){
.dg_remoteRow{padding:10px}
}
`;
		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-git-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-git-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function PaneSplit(props) {
			const Split = typeof window !== "undefined" && window.__dshPaneResizer?.SplitPane;
			if (Split) return React.createElement(Split, props);
			return React.createElement("div", { className: props.className }, props.children);
		}

		const sessionRepoCache = new Map();
		let activeConnection = null;

		function loadRepoPath(sessionId) {
			if (!sessionId) return "";
			if (sessionRepoCache.has(sessionId)) return sessionRepoCache.get(sessionId);
			try {
				const val = localStorage.getItem(STORAGE_PREFIX + sessionId)
					|| localStorage.getItem(STORAGE_REL_PREFIX + sessionId)
					|| "";
				sessionRepoCache.set(sessionId, val);
				return val;
			} catch {
				return "";
			}
		}

		function saveRepoPath(sessionId, absPath, conn) {
			if (!sessionId) return;
			sessionRepoCache.set(sessionId, absPath || "");
			try {
				if (absPath) localStorage.setItem(STORAGE_PREFIX + sessionId, absPath);
				else localStorage.removeItem(STORAGE_PREFIX + sessionId);
			} catch {
				/* ignore */
			}
			const target = conn || activeConnection;
			if (target) {
				callRpc(target, "setSessionRepo", { sessionId, repoPath: absPath || "" }).catch(() => {});
			}
		}

		async function callRpc(connection, endpoint, payload, signal) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {}, signal);
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function rowLegend(tags) {
			const items = (tags || []).filter(Boolean);
			if (!items.length) return null;
			return React.createElement(
				"div",
				{ className: "dg_rowLegend", "aria-hidden": true },
				items.map((tag, i) => {
					const label = typeof tag === "string" ? tag : tag.label;
					const title = typeof tag === "string" ? undefined : tag.title;
					const key = typeof tag === "string" ? tag : (tag.key || tag.label || i);
					return React.createElement("span", { key, className: "dg_pill", title }, label);
				}),
			);
		}

		function DiffView({ text, empty, interactive, onStageHunk, unstageMode, busy }) {
			const content = text == null || text === "" ? "" : String(text);
			if (!content) {
				return React.createElement("pre", { className: "dg_diff dg_diffEmpty" }, empty || "");
			}
			const lines = content.split("\n");
			let hunkIndex = -1;
			return React.createElement(
				"pre",
				{ className: "dg_diff" },
				lines.map((line, i) => {
					let cls = "dg_diffLine";
					const isHunk = line.startsWith("@@");
					if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
						cls += " dg_diffMeta";
					} else if (isHunk) {
						cls += " dg_diffHunk";
						hunkIndex += 1;
					} else if (line.startsWith("+")) {
						cls += " dg_diffAdd";
					} else if (line.startsWith("-")) {
						cls += " dg_diffDel";
					}
					if (interactive && isHunk && typeof onStageHunk === "function") {
						const idx = hunkIndex;
						return React.createElement(
							"div",
							{ key: i, className: "dg_diffLineHunk" },
							React.createElement("span", { className: cls }, line || " "),
							React.createElement("button", {
								type: "button",
								className: "dg_btn dg_btnSm dg_hunkBtn",
								disabled: busy,
								onClick: (e) => {
									e.stopPropagation();
									onStageHunk(idx);
								},
							}, unstageMode ? "Unstage hunk" : "Stage hunk"),
						);
					}
					return React.createElement("span", { key: i, className: cls }, line || " ");
				}),
			);
		}

		function notifyGitAuthChanged() {
			if (typeof window === "undefined") return;
			window.dispatchEvent(new CustomEvent("dsh:git-auth-changed"));
		}

		const FILES_CHANGED_EVENT = "dsh-sf-files-changed";

		function treeRootForRepo(repoPath, parentHint) {
			const repo = String(repoPath || "").replace(/\/+$/, "");
			const hint = String(parentHint || "").replace(/\/+$/, "");
			if (hint && (repo === hint || repo.startsWith(`${hint}/`))) return hint;
			const i = repo.lastIndexOf("/");
			return i > 0 ? repo.slice(0, i) : repo;
		}

		function notifySidebarFilesChanged(changedPath, treeRoot) {
			if (typeof window === "undefined" || typeof changedPath !== "string" || !changedPath) return;
			const detail = { path: changedPath.replace(/\/+$/, "") || changedPath };
			if (typeof treeRoot === "string" && treeRoot.trim()) {
				detail.root = treeRoot.replace(/\/+$/, "") || treeRoot.trim();
			}
			window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT, { detail }));
		}

		function GitView({ sessionId, connection }) {
			const [repoPath, setRepoPath] = React.useState(() => loadRepoPath(sessionId));
			const [repos, setRepos] = React.useState([]);
			const [reposRoot, setReposRoot] = React.useState("/workspace/Git Repos");
			const [status, setStatus] = React.useState(null);
			const [selected, setSelected] = React.useState(null);
			const [diff, setDiff] = React.useState("");
			const [message, setMessage] = React.useState("");
			const [error, setError] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [cloneUrl, setCloneUrl] = React.useState("");
			const [cloneDir, setCloneDir] = React.useState("");
			/** @type {["list"|"changes"|"history", function]} */
			const [page, setPage] = React.useState("list");
			const [auth, setAuth] = React.useState(null);
			const [remoteRepos, setRemoteRepos] = React.useState([]);
			const [remoteBusy, setRemoteBusy] = React.useState(false);
			const [remoteFilter, setRemoteFilter] = React.useState("");
			const [localFilter, setLocalFilter] = React.useState("");
			const [cloneTargets, setCloneTargets] = React.useState([]);
			const [fallbackWs, setFallbackWs] = React.useState(() => (
				typeof window !== "undefined" ? window.__dshCurrentWorkspace?.get?.() || null : null
			));
			const [cloneTargetPath, setCloneTargetPath] = React.useState("");
			const [cloneLayout, setCloneLayout] = React.useState("subfolder");
			const [info, setInfo] = React.useState("");
			const [initFolderPath, setInitFolderPath] = React.useState("");
			const [initSubName, setInitSubName] = React.useState("");
			const [needsAuthorSetup, setNeedsAuthorSetup] = React.useState(false);
			const [authorPromptOpen, setAuthorPromptOpen] = React.useState(false);
			const [authorNameDraft, setAuthorNameDraft] = React.useState("Harness");
			const [authorEmailDraft, setAuthorEmailDraft] = React.useState("harness@local");
			const [allowDefaultAuthor, setAllowDefaultAuthor] = React.useState(false);
			const [publishName, setPublishName] = React.useState("");
			const [publishPrivate, setPublishPrivate] = React.useState(true);
			const [publishDesc, setPublishDesc] = React.useState("");
			const [publishOpenAfter, setPublishOpenAfter] = React.useState(true);
			const publishSeedRef = React.useRef("");
			const [commits, setCommits] = React.useState([]);
			const [selectedCommit, setSelectedCommit] = React.useState(null);
			const [commitDetail, setCommitDetail] = React.useState(null);
			const [historyFile, setHistoryFile] = React.useState(null);
			const [historyDiff, setHistoryDiff] = React.useState("");
			const [historyBusy, setHistoryBusy] = React.useState(false);
			/** @type {[null|{fullName:string,name:string,htmlUrl?:string,cloneUrl?:string,private?:boolean}, function]} */
			const [remoteView, setRemoteView] = React.useState(null);
			/** @type {["local"|"github", function]} */
			const [repoSource, setRepoSource] = React.useState("local");
			const [confirmModal, setConfirmModal] = React.useState(null);
			const [branches, setBranches] = React.useState({ current: null, locals: [], remotes: [] });
			const [branchDraft, setBranchDraft] = React.useState("");
			const [prTitle, setPrTitle] = React.useState("");
			const [prBase, setPrBase] = React.useState("main");
			const [prBody, setPrBody] = React.useState("");
			const [prDraft, setPrDraft] = React.useState(false);
			const [pullRequests, setPullRequests] = React.useState([]);
			const [prBusy, setPrBusy] = React.useState(false);
			const [prPreview, setPrPreview] = React.useState(null);
			const [diffMode, setDiffMode] = React.useState("worktree"); // worktree | staged
			const [showPrPanel, setShowPrPanel] = React.useState(false);
			/** Repo paths whose submodule list is expanded in the hub (default: all collapsed). */
			const [expandedSubmoduleRepos, setExpandedSubmoduleRepos] = React.useState(() => new Set());
			/** Same idea for the toolbar repo picker (native <select> cannot collapse). */
			const [repoPickerOpen, setRepoPickerOpen] = React.useState(false);
			const [pickerExpanded, setPickerExpanded] = React.useState(() => new Set());
			const repoPickerRef = React.useRef(null);

			const toggleSubmoduleList = React.useCallback((path, ev) => {
				ev?.stopPropagation?.();
				if (!path) return;
				setExpandedSubmoduleRepos((prev) => {
					const next = new Set(prev);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			}, []);

			const togglePickerExpand = React.useCallback((path, ev) => {
				ev?.preventDefault?.();
				ev?.stopPropagation?.();
				if (!path) return;
				setPickerExpanded((prev) => {
					const next = new Set(prev);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			}, []);

			React.useEffect(() => {
				if (!repoPickerOpen) return undefined;
				const onDoc = (ev) => {
					if (repoPickerRef.current && !repoPickerRef.current.contains(ev.target)) {
						setRepoPickerOpen(false);
					}
				};
				const onKey = (ev) => {
					if (ev.key === "Escape") setRepoPickerOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDoc);
					document.removeEventListener("keydown", onKey);
				};
			}, [repoPickerOpen]);

			// Keep the parent expanded in the picker when a submodule is selected.
			React.useEffect(() => {
				if (!repoPath || !repos.length) return;
				const parent = repos.find((r) =>
					(r.submodules || []).some((s) => s.path === repoPath),
				);
				if (!parent?.path) return;
				setPickerExpanded((prev) => {
					if (prev.has(parent.path)) return prev;
					const next = new Set(prev);
					next.add(parent.path);
					return next;
				});
			}, [repoPath, repos]);

			React.useEffect(() => {
				setRepoPath(loadRepoPath(sessionId));
				setStatus(null);
				setSelected(null);
				setDiff("");
				setError("");
				activeConnection = connection;
				if (connection && sessionId) {
					callRpc(connection, "listSessionRepos").then((res) => {
						const serverRepo = res?.sessionRepos?.[sessionId];
						if (serverRepo && serverRepo !== repoPath) {
							sessionRepoCache.set(sessionId, serverRepo);
							setRepoPath(serverRepo);
						}
					}).catch(() => {});
				}
			}, [sessionId, connection]);

			const refreshAuth = React.useCallback(async () => {
				if (!connection) return null;
				try {
					const a = await callRpc(connection, "getAuth", {});
					setAuth(a);
					const needs = Boolean(a?.needsAuthorSetup);
					setNeedsAuthorSetup(needs);
					if (needs) {
						setAuthorNameDraft(a.defaultCommitName || a.commitName || "Harness");
						setAuthorEmailDraft(a.defaultCommitEmail || a.commitEmail || "harness@local");
					} else {
						setAuthorPromptOpen(false);
						setAllowDefaultAuthor(false);
					}
					return a;
				} catch {
					return null;
				}
			}, [connection]);

			const loadCloneTargets = React.useCallback(async () => {
				if (!connection) return;
				try {
					const res = await callRpc(connection, "cloneTargets", {
						sessionId,
						workspaceCwd: fallbackWs?.cwd || undefined,
					});
					const targets = res.targets || [];
					setCloneTargets(targets);
					if (res.reposRoot) setReposRoot(res.reposRoot);
					setCloneTargetPath((prev) => {
						if (prev && targets.some((t) => t.path === prev)) return prev;
						return res.defaultTarget || targets[0]?.path || "";
					});
					setInitFolderPath((prev) => {
						if (prev && targets.some((t) => t.path === prev)) return prev;
						return res.defaultTarget || targets[0]?.path || "";
					});
				} catch {
					/* ignore */
				}
			}, [connection, sessionId, fallbackWs]);

			React.useEffect(() => {
				if (typeof window === "undefined") return;
				const onWsChanged = (ev) => setFallbackWs(ev?.detail || null);
				window.addEventListener("dsh-current-workspace-changed", onWsChanged);
				return () => window.removeEventListener("dsh-current-workspace-changed", onWsChanged);
			}, []);

			const loadRemoteRepos = React.useCallback(async () => {
				if (!connection) return;
				setRemoteBusy(true);
				setError("");
				try {
					const res = await callRpc(connection, "github.listRepos", { page: 1, perPage: 50 });
					setRemoteRepos(res.repos || []);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setRemoteBusy(false);
				}
			}, [connection]);

			const refreshRepos = React.useCallback(async () => {
				if (!connection) return;
				try {
					const res = await callRpc(connection, "listRepos", {
						sessionId,
						workspaceCwd: fallbackWs?.cwd || undefined,
					});
					setRepos(res.repos || []);
					if (res.reposRoot) setReposRoot(res.reposRoot);
					return res.repos || [];
				} catch (err) {
					setError(err?.message || String(err));
					return [];
				}
			}, [connection, sessionId, fallbackWs]);

			const doSubmoduleUpdate = async (parentRepoPath, subRelPath) => {
				if (!connection) return;
				setBusy(true);
				setError("");
				setInfo("Updating submodules…");
				try {
					const res = await callRpc(connection, "submoduleUpdate", {
						sessionId,
						repoPath: parentRepoPath,
						subPath: subRelPath || undefined,
					});
					setInfo(res.output || "Submodules updated");
					await refresh();
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const refresh = React.useCallback(async (pathOverride) => {
				if (!connection || !sessionId) return;
				const path = pathOverride !== undefined ? pathOverride : repoPath;
				setBusy(true);
				setError("");
				try {
					const list = await refreshRepos();
					let usePath = path;
					const allPaths = new Set(list.flatMap((r) => [r.path, ...(r.submodules || []).map((s) => s.path)]));
					if (!usePath || (list.length && !allPaths.has(usePath))) {
						usePath = list[0]?.path || "";
					}
					if (!usePath) {
						setStatus({ isRepo: false, cwd: "", files: [] });
						setRepoPath("");
						setBranches({ current: null, locals: [], remotes: [] });
						setPage("list");
						return;
					}
					const next = await callRpc(connection, "status", { sessionId, repoPath: usePath });
					setStatus(next);
					setRepoPath(next.repoPath || usePath);
					saveRepoPath(sessionId, next.repoPath || usePath);
					try {
						const br = await callRpc(connection, "listBranches", { sessionId, repoPath: next.repoPath || usePath });
						setBranches(br || { current: null, locals: [], remotes: [] });
					} catch {
						setBranches({ current: next.branch || null, locals: [], remotes: [] });
					}
					if (next.defaultBranch) setPrBase((prev) => prev || next.defaultBranch);
					const seedPath = next.repoPath || usePath || "";
					if (seedPath && seedPath !== publishSeedRef.current) {
						publishSeedRef.current = seedPath;
						const base = seedPath.split("/").filter(Boolean).pop() || "repo";
						setPublishName(base.replace(/\s+/g, "-"));
						setPublishDesc("");
					}
					if (selected && !(next.files || []).some((f) => f.path === selected.path)) {
						setSelected(null);
						setDiff("");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			}, [connection, sessionId, repoPath, selected, refreshRepos]);

			const openRepoList = React.useCallback(async () => {
				setPage("list");
				setError("");
				await loadCloneTargets();
				await refreshRepos();
				if (auth?.hasHttpsToken && !remoteRepos.length) await loadRemoteRepos();
			}, [loadCloneTargets, loadRemoteRepos, refreshRepos, auth?.hasHttpsToken, remoteRepos.length]);

			const selectHistoryCommit = React.useCallback(async (commit, pathOverride, remoteOverride) => {
				const remote = remoteOverride || remoteView;
				const path = pathOverride || repoPath;
				if (!connection || !commit?.hash) return;
				if (!remote?.fullName && !path) return;
				setSelectedCommit(commit);
				setHistoryFile(null);
				setHistoryDiff("");
				setHistoryBusy(true);
				setError("");
				try {
					let detail;
					if (remote?.fullName) {
						detail = await callRpc(connection, "github.showCommit", {
							fullName: remote.fullName,
							hash: commit.hash,
						});
					} else {
						detail = await callRpc(connection, "showCommit", {
							sessionId,
							repoPath: path,
							hash: commit.hash,
						});
					}
					setCommitDetail(detail);
					const first = detail?.files?.[0];
					if (first) {
						setHistoryFile(first);
						if (remote?.fullName) {
							setHistoryDiff(first.patch || (first.binary
								? "(No textual diff for this file — binary or mode-only change.)"
								: "(No patch available for this file.)"));
						} else {
							const diffRes = await callRpc(connection, "commitDiff", {
								sessionId,
								repoPath: path,
								hash: commit.hash,
								path: first.path,
							});
							setHistoryDiff(diffRes?.diff || "");
						}
					} else {
						setHistoryDiff("No files changed in this commit.");
					}
				} catch (err) {
					setCommitDetail(null);
					setError(err?.message || String(err));
				} finally {
					setHistoryBusy(false);
				}
			}, [connection, sessionId, repoPath, remoteView]);

			const openHistoryFile = React.useCallback(async (file) => {
				if (!file?.path || !selectedCommit?.hash) return;
				setHistoryFile(file);
				if (remoteView?.fullName) {
					setHistoryDiff(file.patch || (file.binary
						? "(No textual diff for this file — binary or mode-only change.)"
						: "(No patch available for this file.)"));
					return;
				}
				if (!connection || !repoPath) return;
				setHistoryBusy(true);
				try {
					const diffRes = await callRpc(connection, "commitDiff", {
						sessionId,
						repoPath,
						hash: selectedCommit.hash,
						path: file.path,
					});
					setHistoryDiff(diffRes?.diff || "");
				} catch (err) {
					setHistoryDiff(err?.message || String(err));
				} finally {
					setHistoryBusy(false);
				}
			}, [connection, sessionId, repoPath, selectedCommit, remoteView]);

			const openHistory = React.useCallback(async (pathOverride, opts = {}) => {
				const forceLocal = opts?.forceLocal === true;
				const activeRemote = forceLocal ? null : remoteView;
				const path = pathOverride || repoPath;
				if (activeRemote?.fullName) {
					setPage("history");
					setError("");
					setHistoryBusy(true);
					try {
						const res = await callRpc(connection, "github.listCommits", {
							fullName: activeRemote.fullName,
							page: 1,
							perPage: 50,
						});
						const list = res?.commits || [];
						setCommits(list);
						if (list[0]) await selectHistoryCommit(list[0], null, activeRemote);
						else {
							setSelectedCommit(null);
							setCommitDetail(null);
							setHistoryDiff("No commits yet.");
						}
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setHistoryBusy(false);
					}
					return;
				}
				if (!path) return;
				setPage("history");
				setError("");
				setHistoryBusy(true);
				try {
					await refresh(path);
					const res = await callRpc(connection, "log", {
						sessionId,
						repoPath: path,
						limit: 100,
					});
					const list = res?.commits || [];
					setCommits(list);
					if (list[0]) {
						await selectHistoryCommit(list[0], path, null);
					} else {
						setSelectedCommit(null);
						setCommitDetail(null);
						setHistoryDiff("No commits yet.");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setHistoryBusy(false);
				}
			}, [repoPath, refresh, connection, sessionId, selectHistoryCommit, remoteView]);

			const selectLocalRepo = React.useCallback((next) => {
				if (!next) return;
				setRepoPickerOpen(false);
				setRemoteView(null);
				setRepoPath(next);
				saveRepoPath(sessionId, next);
				if (page === "history") openHistory(next, { forceLocal: true });
				else refresh(next);
			}, [sessionId, page, openHistory, refresh]);

			const openRemoteHistory = React.useCallback(async (remote) => {
				if (!remote?.fullName) return;
				if (!auth?.hasHttpsToken) {
					setError("Sign in with GitHub to browse remote history");
					return;
				}
				setRepoSource("github");
				setRemoteView({
					fullName: remote.fullName,
					name: remote.name || remote.fullName.split("/").pop(),
					htmlUrl: remote.htmlUrl || "",
					cloneUrl: remote.cloneUrl || "",
					private: Boolean(remote.private),
				});
				setRepoPath("");
				setStatus({ isRepo: true, branch: "remote", remote: remote.cloneUrl || remote.htmlUrl, files: [], recent: [] });
				setPage("history");
				setError("");
				setInfo(`Browsing ${remote.fullName} on GitHub (read-only). Clone to edit locally.`);
				setHistoryBusy(true);
				try {
					const res = await callRpc(connection, "github.listCommits", {
						fullName: remote.fullName,
						page: 1,
						perPage: 50,
					});
					const list = res?.commits || [];
					setCommits(list);
					const remoteMeta = {
						fullName: remote.fullName,
						name: remote.name || remote.fullName.split("/").pop(),
						htmlUrl: remote.htmlUrl || "",
						cloneUrl: remote.cloneUrl || "",
						private: Boolean(remote.private),
					};
					if (list[0]) await selectHistoryCommit(list[0], null, remoteMeta);
					else {
						setSelectedCommit(null);
						setCommitDetail(null);
						setHistoryDiff("No commits yet.");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setHistoryBusy(false);
				}
			}, [auth?.hasHttpsToken, connection, selectHistoryCommit]);

			const switchRepoSource = React.useCallback(async (source) => {
				if (source === "github") {
					if (!auth?.hasHttpsToken) {
						setError("Sign in with GitHub in Settings → Git to browse online repos");
						return;
					}
					setRepoSource("github");
					setError("");
					if (page === "changes") setPage("history");
					try {
						if (!remoteRepos.length) await loadRemoteRepos();
					} catch (err) {
						setError(err?.message || String(err));
					}
					return;
				}
				setRepoSource("local");
				setRemoteView(null);
				setInfo("");
				setCommits([]);
				setSelectedCommit(null);
				setCommitDetail(null);
				setHistoryDiff("");
				if (repoPath) {
					await refresh(repoPath);
					if (page === "history") await openHistory(repoPath, { forceLocal: true });
				}
			}, [auth?.hasHttpsToken, page, remoteRepos.length, loadRemoteRepos, repoPath, refresh, openHistory]);

			const openChanges = React.useCallback(async (pathOverride) => {
				const path = pathOverride || repoPath;
				if (!path) {
					setError("Clone or open a local repo to use Changes");
					return;
				}
				setRepoSource("local");
				setRemoteView(null);
				setPage("changes");
				setError("");
				await refresh(path);
			}, [repoPath, refresh]);

			const openLocalRepo = React.useCallback(async (path) => {
				if (!path) return;
				setRepoSource("local");
				setRemoteView(null);
				setRepoPath(path);
				saveRepoPath(sessionId, path);
				setInfo("");
				await openChanges(path);
			}, [sessionId, openChanges]);

			const normalizeGitUrl = (url) => String(url || "")
				.trim()
				.toLowerCase()
				.replace(/\.git$/i, "")
				.replace(/^git@github\.com:/i, "https://github.com/")
				.replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/");

			const findLocalForRemote = React.useCallback((remote) => {
				const keys = [
					normalizeGitUrl(remote?.cloneUrl),
					normalizeGitUrl(remote?.sshUrl),
					normalizeGitUrl(remote?.htmlUrl),
				].filter(Boolean);
				for (const r of repos) {
					const localKey = normalizeGitUrl(r.remote);
					if (localKey && keys.includes(localKey)) return r;
				}
				if (remote?.name) {
					const byName = repos.find((r) => r.name === remote.name);
					if (byName) return byName;
				}
				return null;
			}, [repos]);

			const maybeLoadRemotes = React.useCallback(async (a) => {
				if (!a?.hasHttpsToken) return;
				const local = await refreshRepos();
				if (!local.length) {
					setPage("list");
					await loadCloneTargets();
				}
				await loadRemoteRepos();
			}, [refreshRepos, loadRemoteRepos, loadCloneTargets]);

			const refreshAll = React.useCallback(async (pathOverride) => {
				const a = await refreshAuth();
				await loadCloneTargets();
				await refresh(pathOverride);
				await maybeLoadRemotes(a);
			}, [refreshAuth, refresh, maybeLoadRemotes, loadCloneTargets]);

			React.useEffect(() => {
				if (!connection) return;
				ensureStyles();
				refreshAll();
			}, [sessionId, connection]); // eslint-disable-line react-hooks/exhaustive-deps

			React.useEffect(() => {
				if (!connection || !auth?.hasHttpsToken || page !== "list") return;
				if (remoteRepos.length || remoteBusy) return;
				loadRemoteRepos();
			}, [connection, auth?.hasHttpsToken, page, remoteRepos.length, remoteBusy, loadRemoteRepos]);

			React.useEffect(() => {
				const onAuthChanged = () => {
					refreshAuth().then((a) => maybeLoadRemotes(a));
				};
				window.addEventListener("dsh:git-auth-changed", onAuthChanged);
				return () => window.removeEventListener("dsh:git-auth-changed", onAuthChanged);
			}, [refreshAuth, maybeLoadRemotes]);

			const buildClonePayload = (url, dirOverride) => {
				const directory = (dirOverride !== undefined ? dirOverride : cloneDir).trim() || undefined;
				return {
					sessionId,
					url,
					directory,
					targetParent: cloneTargetPath,
					layout: cloneLayout,
				};
			};

			const openDiff = async (file, modeOverride) => {
				if (!file) return;
				setSelected(file);
				const mode = modeOverride || (
					file.staged && !file.unstaged ? "staged" : "worktree"
				);
				try {
					const staged = mode === "staged";
					const res = await callRpc(connection, "diff", {
						sessionId,
						repoPath,
						path: file.path,
						staged,
					});
					setDiff(res.diff || "(no diff)");
					setDiffMode(staged ? "staged" : "worktree");
				} catch (err) {
					setDiff(err?.message || String(err));
				}
			};

			const run = async (endpoint, payload) => {
				setBusy(true);
				setError("");
				try {
					const value = await callRpc(connection, endpoint, {
						sessionId,
						repoPath,
						...payload,
					});
					if (value?.repoPath) {
						setRepoPath(value.repoPath);
						saveRepoPath(sessionId, value.repoPath);
						await refresh(value.repoPath);
					} else {
						await refresh();
					}
					return value;
				} catch (err) {
					setError(err?.message || String(err));
					return null;
				} finally {
					setBusy(false);
				}
			};

			const doClone = async (urlOverride, dirOverride) => {
				const url = (urlOverride || cloneUrl).trim();
				if (!url) {
					setError("Paste a git URL (https://… or git@…)");
					return;
				}
				if (!cloneTargetPath) {
					setError("Pick a clone destination");
					return;
				}
				setBusy(true);
				setError("");
				setInfo("");
				try {
					const payload = buildClonePayload(url, dirOverride);
					const value = await callRpc(connection, "clone", payload);
					if (value?.repoPath) {
						setRepoSource("local");
						setRemoteView(null);
						setRepoPath(value.repoPath);
						saveRepoPath(sessionId, value.repoPath);
						setCloneUrl("");
						setCloneDir("");
						setPage("changes");
						setInfo(`Cloned to ${value.repoPath} — open the Code tab / sidebar under that workspace folder to edit files.`);
						await refresh(value.repoPath);
						notifySidebarFilesChanged(
							value.repoPath,
							treeRootForRepo(value.repoPath, cloneTargetPath),
						);
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const openOrCloneRemote = async (remote) => {
				// GitHub list always opens the online repo (API History), even if a local clone exists.
				if (!auth?.hasHttpsToken) {
					setError("Sign in with GitHub to browse remote history");
					return;
				}
				await openRemoteHistory(remote);
			};

			const doInit = async () => {
				const already = new Set(repos.map((r) => r.path));
				const candidates = cloneTargets.filter((t) => !already.has(t.path));
				let parent = (initFolderPath || "").trim();
				if (!parent || !candidates.some((t) => t.path === parent)) {
					parent = candidates[0]?.path || "";
				}
				if (!parent) {
					setError("Pick a folder to initialize");
					return;
				}
				const sub = initSubName.trim();
				if (sub && (/[\\/]/.test(sub) || sub === "." || sub === "..")) {
					setError("Subfolder must be a single folder name");
					return;
				}
				const target = sub ? `${parent.replace(/\/+$/, "")}/${sub}` : parent;
				setBusy(true);
				setError("");
				setInfo("");
				try {
					const value = await callRpc(connection, "init", { sessionId, repoPath: target });
					const repo = value?.repoPath || target;
					setInitFolderPath(parent);
					setInitSubName("");
					setInfo(`Initialized git repo at ${repo}`);
					await refreshRepos();
					await openLocalRepo(repo);
					notifySidebarFilesChanged(repo, treeRootForRepo(repo, parent));
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			if (!connection) {
				return React.createElement("div", { className: "dg_err" }, "Git: connection unavailable");
			}

			const signedIn = Boolean(auth?.hasHttpsToken);
			const authLogin = auth?.githubLogin || "";
			const filteredRemotes = remoteRepos.filter((r) => {
				if (!remoteFilter.trim()) return true;
				const q = remoteFilter.trim().toLowerCase();
				return `${r.fullName} ${r.description || ""}`.toLowerCase().includes(q);
			});
			const filteredLocal = repos.filter((r) => {
				if (!localFilter.trim()) return true;
				const q = localFilter.trim().toLowerCase();
				return `${r.name} ${r.path} ${r.remote || ""} ${r.branch || ""}`.toLowerCase().includes(q);
			});

			const files = status?.files || [];
			const stagedCount = files.filter((f) => f.staged).length;
			const meta = remoteView
				? `GitHub · read-only${remoteView.private ? " · private" : " · public"}`
				: !status
					? "Loading…"
					: !status.isRepo
						? "Pick or clone a repo"
						: `${status.branch || "HEAD"}` +
							(status.hasCompose ? " · compose" : "") +
							` · ${files.length} change(s)` +
							(status.ahead || status.behind ? ` · ↑${status.ahead || 0} ↓${status.behind || 0}` : "");

			const selectedTarget = cloneTargets.find((t) => t.path === cloneTargetPath);
			const repoPathSet = new Set(repos.map((r) => r.path));
			const initCandidates = cloneTargets.filter((t) => !repoPathSet.has(t.path));

			const saveAuthorIdentity = async ({ commitAfter = false } = {}) => {
				const name = authorNameDraft.trim();
				const email = authorEmailDraft.trim();
				if (!name || !email) {
					setError("Name and email are required for the commit author");
					return;
				}
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "setAuth", {
						userName: name,
						userEmail: email,
						sshIdentityFile: auth?.sshIdentityFile || "",
						githubClientId: auth?.githubClientId || "",
					});
					setAuthorPromptOpen(false);
					setAllowDefaultAuthor(false);
					setInfo(`Commit author saved: ${name} <${email}>`);
					await refreshAuth();
					if (typeof window !== "undefined") {
						window.dispatchEvent(new CustomEvent("dsh:git-auth-changed"));
					}
					if (commitAfter && message.trim() && stagedCount > 0) {
						await callRpc(connection, "commit", {
							sessionId,
							repoPath,
							message: message.trim(),
						});
						setMessage("");
						await refresh();
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const requestCommit = async () => {
				if (!message.trim() || stagedCount === 0) return;
				if (needsAuthorSetup && !allowDefaultAuthor) {
					setAuthorPromptOpen(true);
					setError("");
					setInfo("Pick a commit author first — or use the Harness default below.");
					return;
				}
				const value = await run("commit", { message });
				if (value?.committed) setMessage("");
			};

			const doPublish = async () => {
				if (!repoPath) {
					setError("Open a local repo first");
					return;
				}
				if (!auth?.hasHttpsToken) {
					setError("Sign in with GitHub in Settings → Git before publishing");
					return;
				}
				const name = publishName.trim();
				if (!name) {
					setError("GitHub repository name required");
					return;
				}
				setBusy(true);
				setError("");
				setInfo("Creating GitHub repo and pushing…");
				try {
					const value = await callRpc(connection, "publish", {
						sessionId,
						repoPath,
						name,
						description: publishDesc.trim(),
						private: publishPrivate,
					});
					const where = value?.htmlUrl || value?.fullName || name;
					if (value?.pushed) {
						setInfo(`Published to ${where}`);
					} else {
						setInfo(value?.hint || `Created ${where} and set origin — commit, then Push.`);
					}
					if (publishOpenAfter && value?.htmlUrl && typeof window !== "undefined") {
						window.open(value.htmlUrl, "_blank", "noopener,noreferrer");
					}
					await refresh(repoPath);
					await loadRemoteRepos().catch(() => {});
				} catch (err) {
					setError(err?.message || String(err));
					setInfo("");
				} finally {
					setBusy(false);
				}
			};

			const discardPaths = async (paths) => {
				if (!paths?.length) return;
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "discard", { sessionId, repoPath, paths });
					setSelected(null);
					setDiff("");
					setInfo(`Discarded ${paths.length} path(s)`);
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const requestDiscardAll = () => {
				if (!files.length) return;
				setConfirmModal({
					type: "discardAll",
					title: "Discard all local changes?",
					message: `This permanently throws away ${files.length} uncommitted change(s) in this clone (reset --hard + clean). Committed history is kept. GitHub is not touched.`,
				});
			};

			const requestPush = async () => {
				if (!repoPath || !status?.remote) return;
				setBusy(true);
				setError("");
				try {
					const preview = await callRpc(connection, "pushPreview", { sessionId, repoPath });
					setConfirmModal({
						type: "push",
						title: "Push to GitHub?",
						preview,
					});
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const requestPull = async () => {
				if (!repoPath || !status?.remote) return;
				setBusy(true);
				setError("");
				setInfo("Fetching remote to preview pull…");
				try {
					const preview = await callRpc(connection, "pullPreview", { sessionId, repoPath });
					setInfo("");
					setConfirmModal({
						type: "pull",
						title: "Pull from GitHub?",
						preview,
					});
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
					setInfo("");
				} finally {
					setBusy(false);
				}
			};

			const confirmModalAction = async () => {
				if (!confirmModal) return;
				if (confirmModal.type === "push") {
					setBusy(true);
					setError("");
					try {
						const value = await callRpc(connection, "push", {
							sessionId,
							repoPath,
							confirmed: true,
						});
						setInfo(value?.output || "Pushed to origin");
						setConfirmModal(null);
						await refresh(repoPath);
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
					return;
				}
				if (confirmModal.type === "pull") {
					setBusy(true);
					setError("");
					try {
						const value = await callRpc(connection, "pull", {
							sessionId,
							repoPath,
							confirmed: true,
							forceDirty: Boolean(confirmModal.preview?.dirty),
						});
						setInfo(value?.output || "Pulled from origin");
						setConfirmModal(null);
						await refresh(repoPath);
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
					return;
				}
				if (confirmModal.type === "discardAll") {
					setBusy(true);
					setError("");
					try {
						await callRpc(connection, "discardAll", { sessionId, repoPath });
						setSelected(null);
						setDiff("");
						setInfo("Discarded all local uncommitted changes");
						setConfirmModal(null);
						await refresh(repoPath);
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
					return;
				}
				if (confirmModal.type === "switchBranch") {
					setBusy(true);
					setError("");
					try {
						if (confirmModal.prNumber) {
							const value = await callRpc(connection, "checkoutPullRequest", {
								sessionId,
								repoPath,
								number: confirmModal.prNumber,
								dirtyMode: confirmModal.dirtyMode || "stash",
							});
							setConfirmModal(null);
							setInfo(`Checked out ${value.branch} (PR #${confirmModal.prNumber})`);
							setPage("changes");
							await refresh(repoPath);
						} else {
							const value = await callRpc(connection, "switchBranch", {
								sessionId,
								repoPath,
								name: confirmModal.branch,
								create: Boolean(confirmModal.create),
								dirtyMode: confirmModal.dirtyMode || "stash",
							});
							setConfirmModal(null);
							setInfo(
								value?.stashed
									? `Switched to ${confirmModal.branch} (changes stashed)`
									: `Switched to ${confirmModal.branch}`,
							);
							await refresh(repoPath);
							if (page === "history") await openHistory(repoPath, { forceLocal: true });
						}
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
					return;
				}
				if (confirmModal.type === "deleteBranch") {
					setBusy(true);
					setError("");
					try {
						await callRpc(connection, "deleteBranch", {
							sessionId,
							repoPath,
							name: confirmModal.branch,
							force: Boolean(confirmModal.force),
						});
						setConfirmModal(null);
						setInfo(`Deleted branch ${confirmModal.branch}`);
						await refresh(repoPath);
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
					return;
				}
				if (confirmModal.type === "createPr") {
					setBusy(true);
					setError("");
					try {
						const fullName = status?.fullName;
						if (!fullName) throw new Error("Could not detect GitHub repo from origin");
						const created = await callRpc(connection, "github.createPullRequest", {
							fullName,
							title: confirmModal.title,
							head: confirmModal.head,
							base: confirmModal.base,
							body: confirmModal.body || "",
							draft: Boolean(confirmModal.draft),
						});
						setConfirmModal(null);
						setInfo(`Opened PR #${created.number}: ${created.title}`);
						if (created.htmlUrl && typeof window !== "undefined") {
							window.open(created.htmlUrl, "_blank", "noopener,noreferrer");
						}
						await loadPullRequests();
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
				}
			};

			const requestSwitchBranch = (name, { create = false } = {}) => {
				if (!name || name === status?.branch) return;
				if ((status?.files || []).length > 0) {
					setConfirmModal({
						type: "switchBranch",
						title: create ? `Create & switch to ${name}?` : `Switch to ${name}?`,
						branch: name,
						create,
						dirtyMode: "stash",
						message: `You have ${status.files.length} uncommitted change(s). Choose how to handle them.`,
					});
					return;
				}
				(async () => {
					setBusy(true);
					setError("");
					try {
						await callRpc(connection, "switchBranch", {
							sessionId,
							repoPath,
							name,
							create,
							dirtyMode: "fail",
						});
						setInfo(create ? `Created and checked out ${name}` : `Switched to ${name}`);
						await refresh(repoPath);
						if (page === "history") await openHistory(repoPath, { forceLocal: true });
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
				})();
			};

			const createBranchFromDraft = () => {
				const name = branchDraft.trim();
				if (!name) {
					setError("Enter a branch name");
					return;
				}
				setBranchDraft("");
				requestSwitchBranch(name, { create: true });
			};

			const publishCurrentBranch = async () => {
				if (!status?.branch || status.detached) return;
				setBusy(true);
				setError("");
				try {
					const value = await callRpc(connection, "publishBranch", {
						sessionId,
						repoPath,
						name: status.branch,
					});
					setInfo(value?.output || `Published branch ${status.branch}`);
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doStash = async () => {
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "stash", { sessionId, repoPath });
					setInfo("Stashed local changes");
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doStashPop = async () => {
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "stashPop", { sessionId, repoPath });
					setInfo("Restored stash");
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doStashDrop = async () => {
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "stashDrop", { sessionId, repoPath });
					setInfo("Dropped stash");
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doUndoCommit = async () => {
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "undoCommit", { sessionId, repoPath });
					setInfo("Undid last commit (changes kept staged)");
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doAmendCommit = async () => {
				const msg = message.trim();
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "amendCommit", {
						sessionId,
						repoPath,
						message: msg || undefined,
					});
					setMessage("");
					setInfo(msg ? "Amended last commit (new message)" : "Amended last commit (added staged changes)");
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doAbortMerge = async () => {
				setBusy(true);
				setError("");
				try {
					const value = await callRpc(connection, "abortMerge", { sessionId, repoPath });
					setInfo(`Aborted ${value?.aborted || "operation"}`);
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const doContinueMerge = async () => {
				setBusy(true);
				setError("");
				try {
					const value = await callRpc(connection, "continueMerge", { sessionId, repoPath });
					setInfo(`Continued ${value?.continued || "merge"}`);
					await refresh(repoPath);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const stageHunk = async (hunkIndex) => {
				if (!selected?.path) return;
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "stageHunk", {
						sessionId,
						repoPath,
						path: selected.path,
						hunkIndex,
						unstage: diffMode === "staged",
					});
					await refresh(repoPath);
					const st = await callRpc(connection, "status", { sessionId, repoPath });
					const next = (st.files || []).find((f) => f.path === selected.path);
					if (next) await openDiff(next, diffMode === "staged" && next.staged ? "staged" : "worktree");
					else {
						setSelected(null);
						setDiff("");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const loadPullRequests = async () => {
				const fullName = status?.fullName;
				if (!connection || !fullName || !auth?.hasHttpsToken) {
					setPullRequests([]);
					return;
				}
				setPrBusy(true);
				try {
					const res = await callRpc(connection, "github.listPullRequests", {
						fullName,
						state: "open",
					});
					setPullRequests(res.pullRequests || []);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setPrBusy(false);
				}
			};

			const previewPullRequest = async () => {
				const fullName = status?.fullName;
				const head = status?.branch;
				const base = prBase.trim() || status?.defaultBranch || "main";
				if (!fullName || !head) {
					setError("Need origin GitHub remote and a branch");
					return;
				}
				setPrBusy(true);
				setError("");
				try {
					const cmp = await callRpc(connection, "github.compare", {
						fullName,
						base,
						head,
					});
					setPrPreview(cmp);
					if (!prTitle.trim()) {
						const first = cmp.commits?.[0]?.subject;
						setPrTitle(first || `Merge ${head} into ${base}`);
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setPrBusy(false);
				}
			};

			const requestCreatePr = async () => {
				const fullName = status?.fullName;
				const head = status?.branch;
				const base = prBase.trim() || status?.defaultBranch || "main";
				const title = prTitle.trim();
				if (!fullName || !head || !title) {
					setError("PR needs a title, head branch, and GitHub origin");
					return;
				}
				if (status.detached) {
					setError("Detach HEAD — check out a named branch before opening a PR");
					return;
				}
				const currentLocal = (branches.locals || []).find((b) => b.name === head);
				if (!currentLocal?.upstream) {
					setError("Publish this branch to GitHub first (Publish branch), then create the PR");
					return;
				}
				if (!prPreview) await previewPullRequest();
				setConfirmModal({
					type: "createPr",
					title: "Create pull request?",
					head,
					base,
					title,
					body: prBody,
					draft: prDraft,
					preview: prPreview,
				});
			};

			const checkoutPr = (pr) => {
				if (!pr?.number) return;
				if ((status?.files || []).length) {
					setConfirmModal({
						type: "switchBranch",
						title: `Checkout PR #${pr.number}?`,
						branch: `pr-${pr.number}`,
						create: false,
						dirtyMode: "stash",
						prNumber: pr.number,
						message: `You have ${status.files.length} uncommitted change(s). Stash them before checking out the PR branch?`,
					});
					return;
				}
				(async () => {
					setBusy(true);
					setError("");
					try {
						const value = await callRpc(connection, "checkoutPullRequest", {
							sessionId,
							repoPath,
							number: pr.number,
							dirtyMode: "fail",
						});
						setInfo(`Checked out ${value.branch} (PR #${pr.number})`);
						setPage("changes");
						await refresh(repoPath);
					} catch (err) {
						setError(err?.message || String(err));
					} finally {
						setBusy(false);
					}
				})();
			};

			const addRepoHub = React.createElement(
				"div",
				{ className: "dg_hub" },
				React.createElement(
					"div",
					{ className: "dg_hubTop" },
					React.createElement(
						"div",
						{ className: "dg_hubTopBlock" },
						React.createElement("label", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } }, "Clone into"),
						React.createElement("select", {
							className: "dg_select",
							style: { width: "100%", maxWidth: 320 },
							value: cloneTargetPath,
							disabled: busy,
							onChange: (e) => setCloneTargetPath(e.target.value),
						},
							!cloneTargets.length && React.createElement("option", { value: "" }, "Loading…"),
							cloneTargets.map((t) => React.createElement("option", {
								key: t.id || t.path,
								value: t.path,
								title: t.hint || t.path,
							}, t.label)),
						),
						React.createElement("div", { className: "dg_hubInline" },
							React.createElement("label", { className: "dg_check" },
								React.createElement("input", {
									type: "radio",
									name: "cloneLayout",
									checked: cloneLayout === "subfolder",
									disabled: busy,
									onChange: () => setCloneLayout("subfolder"),
								}),
								"Subfolder",
							),
							React.createElement("label", { className: "dg_check" },
								React.createElement("input", {
									type: "radio",
									name: "cloneLayout",
									checked: cloneLayout === "root",
									disabled: busy,
									onChange: () => setCloneLayout("root"),
								}),
								"Into empty folder",
							),
						),
					),
					React.createElement(
						"div",
						{ className: "dg_hubTopBlock dg_hubTopBlockGrow" },
						React.createElement("label", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } }, "Clone from URL"),
						React.createElement("div", { className: "dg_hubInline" },
							React.createElement("input", {
								className: "dg_input",
								style: { flex: 1, minWidth: 200 },
								placeholder: "https://github.com/org/repo.git",
								value: cloneUrl,
								onChange: (e) => setCloneUrl(e.target.value),
								disabled: busy,
							}),
							React.createElement("input", {
								className: "dg_input",
								style: { width: 140, flex: "none" },
								placeholder: "Folder name",
								value: cloneDir,
								onChange: (e) => setCloneDir(e.target.value),
								disabled: busy || cloneLayout === "root",
							}),
							React.createElement("button", {
								type: "button",
								className: "dg_btn dg_btnPrimary",
								disabled: busy || !cloneUrl.trim(),
								onClick: () => doClone(),
							}, busy ? "…" : "Clone"),
						),
					),
				),
				selectedTarget && React.createElement("div", { className: "dg_pathHint", style: { flexShrink: 0, padding: "0 2px" } },
					`Destination: ${selectedTarget.hint || selectedTarget.path}`,
				),
				React.createElement(
					"div",
					{ className: "dg_hubGrid" },
					React.createElement(
						"div",
						{ className: "dg_hubColumn" },
						React.createElement("div", { className: "dg_hubColumnHead" },
							React.createElement("div", { className: "dg_sectionTitle" }, "Local repos"),
							React.createElement("input", {
								className: "dg_input dg_filterInput",
								placeholder: "Filter…",
								value: localFilter,
								onChange: (e) => setLocalFilter(e.target.value),
							}),
							React.createElement("button", {
								type: "button",
								className: "dg_btn",
								disabled: busy,
								onClick: () => refreshRepos(),
							}, "Refresh"),
						),
						React.createElement(
							"div",
							{ className: "dg_remoteList" },
							!filteredLocal.length && React.createElement("div", { className: "dg_hint" }, "No local git repos in workspace yet."),
							filteredLocal.map((r) =>
								React.createElement(
									"div",
									{
										key: r.path,
										className: "dg_remoteRow dg_localRow" + (repoPath === r.path ? " dg_rowActive" : ""),
										title: r.path,
										onClick: () => openLocalRepo(r.path),
									},
									rowLegend([
										r.hasCompose ? "compose" : null,
										Array.isArray(r.submodules) && r.submodules.length > 0
											? {
												key: "subs",
												label: `${r.submodules.length} submodule${r.submodules.length > 1 ? "s" : ""}`,
											}
											: null,
										r.branch ? { key: "branch", label: r.branch } : null,
									]),
									React.createElement(
										"div",
										{ className: "dg_remoteMeta" },
										React.createElement(
											"div",
											{ className: "dg_remoteHead" },
											React.createElement(
												"div",
												{ className: "dg_remoteHeadMain" },
												React.createElement("div", { className: "dg_remoteName" }, r.name),
												React.createElement("div", { className: "dg_remoteDesc" }, r.path || ""),
											),
											React.createElement(
												"div",
												{ className: "dg_remoteActions" },
												React.createElement("button", {
													type: "button",
													className: "dg_btn dg_btnPrimary",
													disabled: busy,
													onClick: (ev) => {
														ev.stopPropagation();
														openLocalRepo(r.path);
													},
												}, "Open"),
											),
										),
										Array.isArray(r.submodules) && r.submodules.length > 0 && (() => {
											const subsOpen = expandedSubmoduleRepos.has(r.path);
											const subLabel = `${r.submodules.length} submodule${r.submodules.length > 1 ? "s" : ""}`;
											return React.createElement(
												"div",
												{ className: "dg_submoduleBlock" },
												React.createElement(
													"button",
													{
														type: "button",
														className: "dg_submoduleToggle",
														"aria-expanded": subsOpen,
														"aria-label": subsOpen ? `Hide ${subLabel}` : `Show ${subLabel}`,
														onClick: (ev) => toggleSubmoduleList(r.path, ev),
													},
													React.createElement(
														"span",
														{ className: "dg_submoduleToggleChev", "aria-hidden": true },
														subsOpen ? "▾" : "▸",
													),
													React.createElement("span", null, subLabel),
												),
												subsOpen && React.createElement(
													"div",
													{ className: "dg_submoduleList" },
													r.submodules.map((sub) =>
												React.createElement(
													"div",
													{
														key: sub.path,
														className: "dg_submoduleRow",
														title: sub.path,
														onClick: (ev) => {
															ev.stopPropagation();
															openLocalRepo(sub.path);
														},
													},
													React.createElement("span", { className: "dg_submoduleIcon" }, "↳"),
													React.createElement(
														"div",
														{ className: "dg_submoduleMeta" },
														React.createElement("span", { className: "dg_submoduleName" }, sub.name),
														React.createElement(
															"span",
															{ className: "dg_submoduleDesc" },
															[sub.commit, sub.branch, sub.status !== "ok" ? sub.status : "", sub.hasCompose ? "compose" : ""].filter(Boolean).join(" · "),
														),
													),
													sub.status === "uninitialized"
														? React.createElement(
															"button",
															{
																type: "button",
																className: "dg_btn dg_btnSm",
																disabled: busy,
																onClick: async (ev) => {
																	ev.stopPropagation();
																	await doSubmoduleUpdate(r.path, sub.relPath);
																},
															},
															"Init",
														)
														: React.createElement(
															"button",
															{
																type: "button",
																className: "dg_btn dg_btnSm dg_btnPrimary",
																disabled: busy,
																onClick: (ev) => {
																	ev.stopPropagation();
																	openLocalRepo(sub.path);
																},
															},
															"Open",
														),
													),
												)),
											);
										})(),
									),
								),
							),
						),
						React.createElement(
							"div",
							{ className: "dg_initBox" },
							React.createElement("div", { className: "dg_sectionTitle" }, "Make folder a git repo"),
							React.createElement("div", { className: "dg_hint" },
								"Run git init on a workspace folder (e.g. Test env) or a new subfolder so it appears above.",
							),
							React.createElement(
								"div",
								{ className: "dg_initRow" },
								React.createElement("select", {
									className: "dg_select",
									value: initCandidates.some((t) => t.path === initFolderPath)
										? initFolderPath
										: (initCandidates[0]?.path || ""),
									disabled: busy || !initCandidates.length,
									title: "Folder to initialize (or parent of a new subfolder)",
									onChange: (e) => setInitFolderPath(e.target.value),
								},
									!initCandidates.length && React.createElement("option", { value: "" }, "No folders available"),
									initCandidates.map((t) => React.createElement("option", {
										key: `init:${t.id || t.path}`,
										value: t.path,
									}, t.label || t.path)),
								),
								React.createElement("input", {
									className: "dg_input",
									placeholder: "Optional new subfolder",
									value: initSubName,
									disabled: busy,
									onChange: (e) => setInitSubName(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") doInit();
									},
								}),
								React.createElement("button", {
									type: "button",
									className: "dg_btn dg_btnPrimary",
									disabled: busy || !(initFolderPath || initCandidates[0]?.path),
									onClick: () => doInit(),
								}, busy ? "…" : "Init"),
							),
							(initFolderPath || initCandidates[0]?.path) && React.createElement("div", { className: "dg_pathHint" },
								(() => {
									const parent = initCandidates.some((t) => t.path === initFolderPath)
										? initFolderPath
										: (initCandidates[0]?.path || "");
									return `Will init: ${initSubName.trim()
										? `${parent.replace(/\/+$/, "")}/${initSubName.trim()}`
										: parent}`;
								})(),
							),
						),
					),
					React.createElement(
						"div",
						{ className: "dg_hubColumn" },
						React.createElement("div", { className: "dg_hubColumnHead" },
							React.createElement("div", { className: "dg_sectionTitle" }, "GitHub repos"),
							signedIn && React.createElement("input", {
								className: "dg_input dg_filterInput",
								placeholder: "Filter…",
								value: remoteFilter,
								onChange: (e) => setRemoteFilter(e.target.value),
							}),
							signedIn && React.createElement("button", {
								type: "button",
								className: "dg_btn",
								disabled: remoteBusy || busy,
								onClick: loadRemoteRepos,
							}, remoteBusy ? "…" : "Refresh"),
							!signedIn && (typeof window !== "undefined" && typeof window.__dshSettingsGear === "function"
								? window.__dshSettingsGear(React, { section: "git", title: "Git settings" })
								: null),
						),
						!signedIn && React.createElement("div", { className: "dg_hint" }, "Sign in via Settings → Git to list GitHub repos."),
						signedIn && React.createElement("div", { className: "dg_hint" }, authLogin ? `Signed in as ${authLogin}` : "Signed in"),
						signedIn && React.createElement(
							"div",
							{ className: "dg_remoteList" },
							!remoteRepos.length && remoteBusy && React.createElement("div", { className: "dg_hint" }, "Loading GitHub repos…"),
							!remoteRepos.length && !remoteBusy && React.createElement("div", { className: "dg_hint" }, "No GitHub repos found. Use Refresh to reload."),
							filteredRemotes.map((r) => {
								const local = findLocalForRemote(r);
								return React.createElement(
									"div",
									{
										key: r.id || r.fullName,
										className: "dg_remoteRow" + (remoteView?.fullName === r.fullName ? " dg_rowActive" : ""),
										onClick: () => openOrCloneRemote(r),
										title: `Open on GitHub: ${r.fullName}`,
										style: { cursor: "pointer" },
									},
									rowLegend([
										r.private ? "private" : "public",
										local ? { key: "cloned", label: "cloned", title: local.path } : null,
									]),
									React.createElement(
										"div",
										{ className: "dg_remoteMeta" },
										React.createElement("div", { className: "dg_remoteName" }, r.fullName),
										React.createElement("div", { className: "dg_remoteDesc" }, r.description || r.htmlUrl || ""),
									),
									React.createElement(
										"div",
										{ className: "dg_remoteActions" },
										React.createElement("button", {
											type: "button",
											className: "dg_btn dg_btnPrimary",
											disabled: busy || !auth?.hasHttpsToken,
											title: "Browse this repo on GitHub (History via API)",
											onClick: (ev) => {
												ev.stopPropagation();
												openRemoteHistory(r);
											},
										}, "Open"),
										local
											? React.createElement("button", {
												type: "button",
												className: "dg_btn",
												disabled: busy,
												title: `Open local clone: ${local.path}`,
												onClick: (ev) => {
													ev.stopPropagation();
													openLocalRepo(local.path);
												},
											}, "Local")
											: React.createElement("button", {
												type: "button",
												className: "dg_btn",
												disabled: busy,
												onClick: (ev) => {
													ev.stopPropagation();
													doClone(r.cloneUrl, r.name);
												},
											}, busy ? "…" : "Clone"),
									),
								);
							}),
						),
					),
				),
			);

			return React.createElement(
				"div",
				{ className: "dg_root" },
				React.createElement(
					"div",
					{ className: "dg_authBar" },
					signedIn
						? React.createElement("span", { className: "dg_authOk" }, `GitHub: ${authLogin || "signed in"}`)
						: React.createElement("span", null, "GitHub: not signed in — use Settings → Git → Sign in with GitHub"),
					React.createElement(
						"div",
						{
							className: "dg_modeToggle",
							role: "tablist",
							"aria-label": "Git view",
						},
						React.createElement("button", {
							type: "button",
							role: "tab",
							"aria-selected": page === "list",
							className: page === "list" ? "dg_modeOn" : "",
							disabled: busy || remoteBusy,
							onClick: () => openRepoList(),
						}, "Repos"),
						React.createElement("button", {
							type: "button",
							role: "tab",
							"aria-selected": page === "changes",
							className: page === "changes" ? "dg_modeOn" : "",
							disabled: busy || remoteBusy || (!repoPath && !remoteView),
							title: remoteView
								? "Staging is local — opens your clone if you have one, otherwise clone first"
								: (repoPath ? "Working tree / staging" : "Open a local repo first"),
							onClick: () => {
								if (remoteView) {
									const local = findLocalForRemote(remoteView);
									if (local?.path) {
										openLocalRepo(local.path);
										return;
									}
									setError("Changes (stage/commit) need a local clone — use Clone, then open from Local repos.");
									return;
								}
								openChanges();
							},
						}, "Changes"),
						React.createElement("button", {
							type: "button",
							role: "tab",
							"aria-selected": page === "history",
							className: page === "history" ? "dg_modeOn" : "",
							disabled: busy || remoteBusy || historyBusy || (!repoPath && !remoteView),
							title: remoteView || repoPath ? "Commit history" : "Open a local or GitHub repo first",
							onClick: () => openHistory(),
						}, "History"),
					),
					typeof window !== "undefined" && typeof window.__dshSettingsGear === "function"
						? window.__dshSettingsGear(React, { section: "git", title: "Git settings" })
						: null,
				),
				React.createElement(
					"div",
					{ className: "dg_bar" },
					React.createElement(
						"div",
						{
							className: "dg_modeToggle",
							role: "group",
							"aria-label": "Repo source",
						},
						React.createElement("button", {
							type: "button",
							className: repoSource === "local" ? "dg_modeOn" : "",
							disabled: busy || remoteBusy || historyBusy,
							onClick: () => switchRepoSource("local"),
							title: "List local clones",
						}, "Local"),
						React.createElement("button", {
							type: "button",
							className: repoSource === "github" ? "dg_modeOn" : "",
							disabled: busy || remoteBusy || historyBusy || !auth?.hasHttpsToken,
							onClick: () => switchRepoSource("github"),
							title: auth?.hasHttpsToken
								? "List GitHub remotes (History is read-only until cloned)"
								: "Sign in with GitHub in Settings first",
						}, "GitHub"),
					),
					repoSource === "local"
						? (() => {
							const selectedRepo = repos.find((r) => r.path === repoPath)
								|| repos.find((r) => (r.submodules || []).some((s) => s.path === repoPath));
							const selectedSub = selectedRepo
								? (selectedRepo.submodules || []).find((s) => s.path === repoPath)
								: null;
							const label = !repos.length && !repoPath
								? "No local repos yet"
								: selectedSub
									? `↳ ${selectedSub.name} (submodule)`
									: selectedRepo
										? `${selectedRepo.name}${selectedRepo.hasCompose ? " · compose" : ""}`
										: (repoPath ? repoPath.split("/").filter(Boolean).pop() : "Select a repo…");
							return React.createElement(
								"div",
								{ className: "dg_picker", ref: repoPickerRef },
								React.createElement("button", {
									type: "button",
									className: "dg_pickerBtn",
									disabled: busy || (!repos.length && !repoPath),
									title: "Local git repos — expand a parent to see submodules",
									"aria-haspopup": "listbox",
									"aria-expanded": repoPickerOpen,
									onClick: () => setRepoPickerOpen((v) => !v),
								},
									React.createElement("span", { className: "dg_pickerLabel" }, label),
									React.createElement("span", { className: "dg_pickerChev", "aria-hidden": true },
										repoPickerOpen ? "▴" : "▾"),
								),
								repoPickerOpen && React.createElement(
									"div",
									{ className: "dg_pickerMenu", role: "listbox" },
									!repos.length && React.createElement("div", { className: "dg_pickerEmpty" },
										"No local repos yet"),
									repos.map((r) => {
										const subs = r.submodules || [];
										const expanded = pickerExpanded.has(r.path);
										const parentActive = repoPath === r.path;
										return React.createElement(
											React.Fragment,
											{ key: r.path },
											React.createElement(
												"div",
												{
													className: "dg_pickerRow" + (parentActive ? " dg_pickerRowActive" : ""),
												},
												subs.length
													? React.createElement("button", {
														type: "button",
														className: "dg_pickerExpand",
														title: expanded ? "Hide submodules" : "Show submodules",
														"aria-label": expanded ? "Collapse submodules" : "Expand submodules",
														"aria-expanded": expanded,
														onClick: (ev) => togglePickerExpand(r.path, ev),
													}, expanded ? "▾" : "▸")
													: React.createElement("span", { className: "dg_pickerExpandSpacer" }),
												React.createElement("button", {
													type: "button",
													className: "dg_pickerPick",
													role: "option",
													"aria-selected": parentActive,
													onClick: () => selectLocalRepo(r.path),
												}, `${r.name}${r.hasCompose ? " · compose" : ""}${subs.length ? ` · ${subs.length} sub` : ""}`),
											),
											expanded && subs.map((sub) =>
												React.createElement(
													"div",
													{
														key: sub.path,
														className: "dg_pickerRow dg_pickerSub"
															+ (repoPath === sub.path ? " dg_pickerRowActive" : ""),
													},
													React.createElement("span", { className: "dg_pickerExpandSpacer" }),
													React.createElement("button", {
														type: "button",
														className: "dg_pickerPick",
														role: "option",
														"aria-selected": repoPath === sub.path,
														onClick: () => selectLocalRepo(sub.path),
													}, `↳ ${sub.name} (submodule)`),
												),
											),
										);
									}),
								),
							);
						})()
						: React.createElement("select", {
							className: "dg_select dg_selectWide",
							value: remoteView ? `gh:${remoteView.fullName}` : "",
							disabled: busy || remoteBusy || !remoteRepos.length,
							title: "GitHub repositories (History via API)",
							onChange: (e) => {
								const fullName = String(e.target.value || "").replace(/^gh:/, "");
								const remote = remoteRepos.find((r) => r.fullName === fullName);
								if (remote) openRemoteHistory(remote);
							},
						},
							!remoteRepos.length && React.createElement("option", { value: "" }, remoteBusy ? "Loading GitHub repos…" : "No GitHub repos loaded"),
							remoteRepos.length > 0 && !remoteView && React.createElement("option", { value: "" }, "Select a GitHub repo…"),
							remoteRepos.map((r) =>
								React.createElement("option", {
									key: r.id || r.fullName,
									value: `gh:${r.fullName}`,
								}, `${r.fullName}${r.private ? " · private" : ""}`),
							),
						),
					React.createElement("span", {
						className: "dg_meta",
						title: remoteView
							? (remoteView.htmlUrl || remoteView.fullName)
							: [status?.repoPath || status?.repoRoot, status?.remote].filter(Boolean).join("\n"),
					}, meta),
					React.createElement("button", {
						type: "button",
						className: "dg_btn",
						disabled: busy || historyBusy || remoteBusy,
						onClick: () => {
							if (repoSource === "github") {
								if (remoteView) openHistory();
								else loadRemoteRepos();
							} else {
								refreshAll();
							}
						},
					}, "Refresh"),
					(page === "changes" || page === "history") && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button", className: "dg_btn", disabled: busy || !status?.remote,
						onClick: () => run("fetch"), title: status?.remote ? "Fetch" : "No origin remote yet",
					}, "Fetch"),
					(page === "changes" || page === "history") && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button", className: "dg_btn", disabled: busy || !status?.remote,
						onClick: () => requestPull(), title: status?.remote ? "Pull --ff-only" : "No origin remote yet",
					}, "Pull"),
					(page === "changes" || page === "history") && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button", className: "dg_btn", disabled: busy || !status?.remote,
						onClick: () => requestPush(), title: status?.remote ? "Push to origin (asks for confirm)" : "No origin — Publish to GitHub first",
					}, "Push"),
					page === "changes" && !remoteView && status?.isRepo && !status?.remote && React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnPrimary",
						disabled: busy || !auth?.hasHttpsToken,
						onClick: () => doPublish(),
						title: auth?.hasHttpsToken
							? "Create GitHub repo, set origin, and push"
							: "Sign in with GitHub in Settings first",
					}, busy ? "…" : "Publish"),
					page === "changes" && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button", className: "dg_btn", disabled: busy || files.length === 0,
						onClick: () => run("stageAll"),
					}, "Stage all"),
					page === "changes" && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button", className: "dg_btn", disabled: busy || stagedCount === 0,
						onClick: () => run("unstageAll"),
					}, "Unstage all"),
					page === "changes" && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button",
						className: "dg_btn",
						disabled: busy || files.length === 0,
						onClick: () => doStash(),
						title: "Stash all uncommitted changes (including untracked)",
					}, "Stash"),
					page === "changes" && !remoteView && status?.isRepo && React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnDanger",
						disabled: busy || files.length === 0,
						onClick: () => requestDiscardAll(),
						title: "Throw away all uncommitted local changes (does not touch GitHub)",
					}, "Discard all"),
					(page === "changes" || page === "history") && remoteView && (() => {
						const localTwin = findLocalForRemote(remoteView);
						if (localTwin?.path) {
							return React.createElement("button", {
								type: "button",
								className: "dg_btn",
								disabled: busy,
								onClick: () => openLocalRepo(localTwin.path),
								title: `Switch to local clone: ${localTwin.path}`,
							}, "Open local");
						}
						return remoteView.cloneUrl
							? React.createElement("button", {
								type: "button",
								className: "dg_btn dg_btnPrimary",
								disabled: busy,
								onClick: () => doClone(remoteView.cloneUrl, remoteView.name),
								title: "Clone this GitHub repo locally to edit",
							}, busy ? "…" : "Clone")
							: null;
					})(),
				),
				!remoteView && status?.isRepo && (page === "changes" || page === "history") && React.createElement(
					"div",
					{ className: "dg_branchBar" },
					React.createElement("span", { className: "dg_hint", style: { flex: "none" } }, "Branch"),
					React.createElement("select", {
						className: "dg_select",
						value: status.detached ? "" : (status.branch || ""),
						disabled: busy || status.detached,
						title: status.detached ? "Detached HEAD" : "Current branch",
						onChange: (e) => {
							const next = e.target.value;
							if (!next || next === status.branch) return;
							if (next === "__new__") {
								const name = window.prompt("New branch name");
								if (name) requestSwitchBranch(name.trim(), { create: true });
								return;
							}
							requestSwitchBranch(next);
						},
					},
						status.detached && React.createElement("option", { value: "" }, `detached ${status.branch}`),
						(branches.locals || []).map((b) =>
							React.createElement("option", {
								key: b.name,
								value: b.name,
								title: [b.upstream && `↑ ${b.upstream}`, b.shortHash].filter(Boolean).join(" · "),
							}, b.name),
						),
						(branches.remotes || []).length > 0 && React.createElement("option", { disabled: true, value: "" }, "── remotes ──"),
						(branches.remotes || []).map((b) =>
							React.createElement("option", {
								key: b.name,
								value: b.name,
								title: b.shortHash || b.name,
							}, b.name),
						),
						React.createElement("option", { value: "__new__" }, "+ New branch…"),
					),
					React.createElement("input", {
						className: "dg_input",
						style: { maxWidth: 160, height: 30, flex: "none" },
						placeholder: "new-branch",
						value: branchDraft,
						disabled: busy,
						onChange: (e) => setBranchDraft(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter") createBranchFromDraft();
						},
					}),
					React.createElement("button", {
						type: "button",
						className: "dg_btn",
						disabled: busy || !branchDraft.trim(),
						onClick: () => createBranchFromDraft(),
					}, "Create"),
					status.remote && !status.detached && React.createElement("button", {
						type: "button",
						className: "dg_btn",
						disabled: busy,
						title: "Push this branch and set upstream (git push -u)",
						onClick: () => publishCurrentBranch(),
					}, "Publish branch"),
					status.branch && !status.detached && React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnDanger",
						disabled: busy || (branches.locals || []).length < 2,
						title: "Delete a different local branch…",
						onClick: () => {
							const others = (branches.locals || []).filter((b) => b.name !== status.branch);
							const name = window.prompt(
								`Delete which local branch?\n\n${others.map((b) => b.name).join("\n")}`,
								others[0]?.name || "",
							);
							if (!name || name === status.branch) return;
							setConfirmModal({
								type: "deleteBranch",
								title: `Delete branch ${name}?`,
								branch: name,
								force: false,
								message: `Delete local branch “${name}”? This cannot be undone. Remote branches are not deleted.`,
							});
						},
					}, "Delete…"),
					status.fullName && auth?.hasHttpsToken && React.createElement("button", {
						type: "button",
						className: "dg_btn" + (showPrPanel ? " dg_btnPrimary" : ""),
						disabled: busy || prBusy,
						onClick: () => {
							setShowPrPanel((v) => !v);
							if (!showPrPanel) loadPullRequests();
						},
					}, showPrPanel ? "Hide PRs" : "Pull requests"),
				),
				!remoteView && status?.isRepo && showPrPanel && (page === "changes" || page === "history") && React.createElement(
					"div",
					{ className: "dg_prBox" },
					React.createElement("div", { className: "dg_publishTitle" }, "Pull requests"),
					React.createElement("div", { className: "dg_prRow" },
						React.createElement("input", {
							className: "dg_input",
							placeholder: "PR title",
							value: prTitle,
							disabled: busy || prBusy,
							onChange: (e) => setPrTitle(e.target.value),
						}),
						React.createElement("input", {
							className: "dg_input",
							style: { maxWidth: 140, flex: "none" },
							placeholder: "base (main)",
							value: prBase,
							disabled: busy || prBusy,
							onChange: (e) => setPrBase(e.target.value),
						}),
						React.createElement("label", { className: "dg_checkLabel" },
							React.createElement("input", {
								type: "checkbox",
								checked: prDraft,
								disabled: busy || prBusy,
								onChange: (e) => setPrDraft(e.target.checked),
							}),
							"Draft",
						),
						React.createElement("button", {
							type: "button",
							className: "dg_btn",
							disabled: busy || prBusy || !status.branch || status.detached,
							onClick: () => previewPullRequest(),
						}, prBusy ? "…" : "Preview"),
						React.createElement("button", {
							type: "button",
							className: "dg_btn dg_btnPrimary",
							disabled: busy || prBusy || !status.branch || status.detached || !prTitle.trim(),
							onClick: () => requestCreatePr(),
						}, "Create PR"),
					),
					React.createElement("input", {
						className: "dg_input",
						placeholder: "PR description (optional)",
						value: prBody,
						disabled: busy || prBusy,
						onChange: (e) => setPrBody(e.target.value),
					}),
					prPreview && React.createElement("div", { className: "dg_hint" },
						`Compare ${prBase || "base"} ← ${status.branch}: ${prPreview.aheadBy || 0} commit(s) ahead, ${(prPreview.files || []).length} file(s)`,
					),
					React.createElement("div", { className: "dg_prRow" },
						React.createElement("div", { className: "dg_sectionTitle", style: { flex: 1 } }, "Open PRs"),
						React.createElement("button", {
							type: "button",
							className: "dg_btn dg_btnSm",
							disabled: prBusy || busy,
							onClick: () => loadPullRequests(),
						}, prBusy ? "…" : "Refresh"),
					),
					React.createElement("div", { className: "dg_prList" },
						!pullRequests.length && React.createElement("div", { className: "dg_hint" }, "No open pull requests."),
						pullRequests.map((pr) =>
							React.createElement("div", { key: pr.number, className: "dg_prItem" },
								React.createElement("span", { style: { flex: 1, minWidth: 0 } },
									`#${pr.number} ${pr.title}${pr.draft ? " (draft)" : ""}`,
								),
								React.createElement("span", { className: "dg_hint" },
									`${pr.headRef} → ${pr.baseRef}`,
								),
								React.createElement("button", {
									type: "button",
									className: "dg_btn dg_btnSm",
									disabled: busy,
									onClick: () => checkoutPr(pr),
								}, "Checkout"),
								pr.htmlUrl && React.createElement("button", {
									type: "button",
									className: "dg_btn dg_btnSm",
									onClick: () => window.open(pr.htmlUrl, "_blank", "noopener,noreferrer"),
								}, "Open"),
							),
						),
					),
				),
				!remoteView && status?.isRepo && (status.mergeInProgress || status.rebaseInProgress || status.cherryPickInProgress || (status.conflictFiles || []).length > 0) && React.createElement(
					"div",
					{ className: "dg_banner dg_bannerErr" },
					React.createElement("div", { className: "dg_bannerText" },
						status.rebaseInProgress
							? "Rebase in progress"
							: status.cherryPickInProgress
								? "Cherry-pick in progress"
								: status.mergeInProgress
									? "Merge in progress"
									: "Conflicted files",
						(status.conflictFiles || []).length
							? ` — ${(status.conflictFiles || []).length} file(s): ${(status.conflictFiles || []).slice(0, 5).join(", ")}${(status.conflictFiles || []).length > 5 ? "…" : ""}`
							: ". Resolve conflicts in the editor, stage the files, then Continue.",
					),
					React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnPrimary",
						disabled: busy || (status.conflictFiles || []).length > 0,
						onClick: () => doContinueMerge(),
					}, "Continue"),
					React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnDanger",
						disabled: busy,
						onClick: () => doAbortMerge(),
					}, "Abort"),
				),
				!remoteView && status?.isRepo && (status.stashes || []).length > 0 && React.createElement(
					"div",
					{ className: "dg_banner dg_bannerInfo" },
					React.createElement("div", { className: "dg_bannerText" },
						`Stash: ${(status.stashes[0].subject || status.stashes[0].ref)} (${status.stashes.length} saved)`,
					),
					React.createElement("button", {
						type: "button",
						className: "dg_btn",
						disabled: busy,
						onClick: () => doStashPop(),
					}, "Restore"),
					React.createElement("button", {
						type: "button",
						className: "dg_btn dg_btnDanger",
						disabled: busy,
						onClick: () => doStashDrop(),
					}, "Drop"),
				),
				error && React.createElement("div", { className: "dg_err" }, error),
				info && !error && React.createElement("div", { className: "dg_hint", style: { padding: "8px 14px" } }, info),
				page === "list" && React.createElement("div", { className: "dg_setup", style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 0, borderBottom: "none" } }, addRepoHub),
				page === "changes" && !status?.isRepo && React.createElement(
					"div",
					{ className: "dg_empty" },
					busy ? "Loading repo…" : "Open a local repo from Repos to see changes.",
				),
				page === "changes" && status?.isRepo && !status.remote && React.createElement(
					"div",
					{ className: "dg_publish" },
					React.createElement("div", { className: "dg_publishTitle" }, "Publish to GitHub"),
					React.createElement("div", { className: "dg_publishHint" },
						auth?.hasHttpsToken
							? "Creates a GitHub repo under your account, sets origin, and pushes this branch. Does not add a README (so your local history can push cleanly)."
							: "Sign in with GitHub in Settings → Git first, then you can publish this local repo.",
					),
					React.createElement(
						"div",
						{ className: "dg_publishRow" },
						React.createElement("input", {
							className: "dg_input",
							placeholder: "Repository name",
							value: publishName,
							disabled: busy || !auth?.hasHttpsToken,
							onChange: (e) => setPublishName(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") doPublish();
							},
						}),
						React.createElement("input", {
							className: "dg_input",
							placeholder: "Description (optional)",
							value: publishDesc,
							disabled: busy || !auth?.hasHttpsToken,
							onChange: (e) => setPublishDesc(e.target.value),
						}),
					),
					React.createElement(
						"div",
						{ className: "dg_publishRow" },
						React.createElement(
							"div",
							{
								className: "dg_modeToggle",
								role: "group",
								"aria-label": "Repository visibility",
							},
							React.createElement("button", {
								type: "button",
								className: !publishPrivate ? "dg_modeOn" : "",
								disabled: busy || !auth?.hasHttpsToken,
								onClick: () => setPublishPrivate(false),
								title: "Anyone on the internet can see this repository",
							}, "Public"),
							React.createElement("button", {
								type: "button",
								className: publishPrivate ? "dg_modeOn" : "",
								disabled: busy || !auth?.hasHttpsToken,
								onClick: () => setPublishPrivate(true),
								title: "Only you (and people you invite) can see this repository",
							}, "Private"),
						),
						React.createElement("label", { className: "dg_checkLabel" },
							React.createElement("input", {
								type: "checkbox",
								checked: publishOpenAfter,
								disabled: busy || !auth?.hasHttpsToken,
								onChange: (e) => setPublishOpenAfter(e.target.checked),
							}),
							"Open on GitHub after",
						),
						React.createElement("button", {
							type: "button",
							className: "dg_btn dg_btnPrimary",
							disabled: busy || !auth?.hasHttpsToken || !publishName.trim(),
							onClick: () => doPublish(),
						}, busy ? "Publishing…" : "Publish"),
					),
					auth?.githubLogin && React.createElement("div", { className: "dg_pathHint" },
						`Will create: github.com/${auth.githubLogin}/${publishName.trim() || "…"} (${publishPrivate ? "private" : "public"})`,
					),
				),
				page === "changes" && status?.isRepo && !remoteView && React.createElement(
					PaneSplit,
					{
						className: "dg_body",
						storageKey: "git.changes",
						defaultRatio: 0.38,
						minFirst: 200,
						minSecond: 280,
					},
					React.createElement(
						"div",
						{ className: "dg_list" },
						status.submodules && status.submodules.length > 0 && React.createElement(
							"div",
							{ className: "dg_submodulesSection" },
							React.createElement(
								"div",
								{ className: "dg_submodulesHeader" },
								React.createElement("span", null, `Submodules (${status.submodules.length})`),
								React.createElement(
									"button",
									{
										type: "button",
										className: "dg_btn dg_btnSm",
										disabled: busy,
										onClick: () => doSubmoduleUpdate(status.repoPath),
										title: "git submodule update --init --recursive",
									},
									"Update all",
								),
							),
							React.createElement(
								"div",
								{ className: "dg_submoduleList", style: { margin: 0, paddingLeft: 0, borderLeft: "none" } },
								status.submodules.map((sub) =>
									React.createElement(
										"div",
										{
											key: sub.path,
											className: "dg_submoduleRow",
											title: sub.path,
											onClick: () => openLocalRepo(sub.path),
										},
										React.createElement("span", { className: "dg_submoduleIcon" }, "↳"),
										React.createElement(
											"div",
											{ className: "dg_submoduleMeta" },
											React.createElement("span", { className: "dg_submoduleName" }, sub.name),
											React.createElement(
												"span",
												{ className: "dg_submoduleDesc" },
												[sub.commit, sub.branch, sub.status !== "ok" ? sub.status : "", sub.hasCompose ? "compose" : ""].filter(Boolean).join(" · "),
											),
										),
										sub.status === "uninitialized"
											? React.createElement(
												"button",
												{
													type: "button",
													className: "dg_btn dg_btnSm",
													disabled: busy,
													onClick: async (ev) => {
														ev.stopPropagation();
														await doSubmoduleUpdate(status.repoPath, sub.relPath);
													},
												},
												"Init",
											)
											: React.createElement(
												"button",
												{
													type: "button",
													className: "dg_btn dg_btnSm dg_btnPrimary",
													disabled: busy,
													onClick: (ev) => {
														ev.stopPropagation();
														openLocalRepo(sub.path);
													},
												},
												"Open",
											),
									),
								),
							),
						),
						files.length === 0 && React.createElement("div", { className: "dg_empty" },
							React.createElement("div", { style: { fontWeight: 600, marginBottom: 6 } }, "No uncommitted changes"),
							React.createElement("div", null,
								status?.detached
									? "This clone matches the checked-out commit (submodules often sit on a detached HEAD). Switch to History to browse commits, or create/checkout a branch above to start editing."
									: "The working tree matches HEAD — nothing to stage or commit. Switch to History to browse past commits, or edit files in the workspace to see them here.",
							),
						),
						files.map((f) =>
							React.createElement(
								"div",
								{
									key: f.path,
									className: "dg_row" + (selected?.path === f.path ? " dg_rowActive" : ""),
									onClick: () => openDiff(f),
								},
								React.createElement("span", { className: "dg_badge" }, f.conflict ? "UU" : `${f.index}${f.worktree}`),
								React.createElement("span", {
									style: {
										flex: 1,
										minWidth: 0,
										overflow: "hidden",
										textOverflow: "ellipsis",
										color: f.conflict ? "var(--dsw-alias-state-error-primary)" : undefined,
									},
								}, f.path),
								!f.conflict && React.createElement(
									"button",
									{
										type: "button",
										className: "dg_btn dg_btnSm",
										disabled: busy,
										onClick: (e) => {
											e.stopPropagation();
											run(f.staged && !f.unstaged ? "unstage" : "stage", { paths: [f.path] });
										},
									},
									f.staged && !f.unstaged ? "Unstage" : "Stage",
								),
								f.conflict && React.createElement(
									"button",
									{
										type: "button",
										className: "dg_btn dg_btnSm",
										disabled: busy,
										title: "Mark conflict resolved (git add)",
										onClick: (e) => {
											e.stopPropagation();
											run("stage", { paths: [f.path] });
										},
									},
									"Mark resolved",
								),
								React.createElement(
									"button",
									{
										type: "button",
										className: "dg_btn dg_btnSm dg_btnDanger",
										disabled: busy || f.conflict,
										title: "Discard local changes to this file (not reversible)",
										onClick: (e) => {
											e.stopPropagation();
											discardPaths([f.path]);
										},
									},
									"Discard",
								),
							),
						),
					),
					React.createElement(
						"div",
						{ className: "dg_diffPane" },
						selected && React.createElement(
							"div",
							{ className: "dg_diffToolbar" },
							React.createElement("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, selected.path),
							selected.staged && React.createElement("button", {
								type: "button",
								className: "dg_btn dg_btnSm" + (diffMode === "staged" ? " dg_btnPrimary" : ""),
								disabled: busy,
								onClick: () => openDiff(selected, "staged"),
							}, "Staged"),
							selected.unstaged && React.createElement("button", {
								type: "button",
								className: "dg_btn dg_btnSm" + (diffMode === "worktree" ? " dg_btnPrimary" : ""),
								disabled: busy,
								onClick: () => openDiff(selected, "worktree"),
							}, "Unstaged"),
						),
						React.createElement(DiffView, {
							text: diff,
							empty: "Select a file to see the diff.",
							interactive: Boolean(selected && !selected.conflict && !remoteView),
							unstageMode: diffMode === "staged",
							busy,
							onStageHunk: stageHunk,
						}),
					),
				),
				page === "history" && !status?.isRepo && !remoteView && React.createElement(
					"div",
					{ className: "dg_empty" },
					busy || historyBusy ? "Loading history…" : "Open a local repo or a GitHub remote to see history.",
				),
				page === "history" && (status?.isRepo || remoteView) && React.createElement(
					PaneSplit,
					{
						className: "dg_history",
						storageKey: "git.history-commits",
						defaultRatio: 0.34,
						minFirst: 220,
						minSecond: 320,
					},
					React.createElement(
						"div",
						{ className: "dg_list dg_historyList" },
						!commits.length && !historyBusy && React.createElement("div", { className: "dg_empty" }, "No commits yet."),
						commits.map((c) =>
							React.createElement(
								"div",
								{
									key: c.hash,
									className: "dg_recentRow" + (selectedCommit?.hash === c.hash ? " dg_recentRowActive" : ""),
									onClick: () => selectHistoryCommit(c),
								},
								React.createElement(
									"div",
									{ style: { flex: 1, minWidth: 0 } },
									React.createElement("div", { className: "dg_recentMsg" }, c.subject || "(no subject)"),
									React.createElement("div", { className: "dg_recentMeta" },
										[c.authorName, c.authoredAt ? new Date(c.authoredAt).toLocaleString() : "", c.shortHash]
											.filter(Boolean)
											.join(" · "),
									),
								),
							),
						),
					),
					React.createElement(
						"div",
						{ className: "dg_historyDetail" },
						!commitDetail && React.createElement("div", { className: "dg_empty" }, historyBusy ? "Loading…" : "Select a commit."),
						commitDetail && React.createElement(
							"div",
							{ className: "dg_historyHead" },
							React.createElement("div", { className: "dg_historySubject" }, commitDetail.subject || "(no subject)"),
							commitDetail.body
								? React.createElement("pre", { className: "dg_historyBody" }, commitDetail.body)
								: null,
							React.createElement("div", { className: "dg_historyStats" },
								[
									commitDetail.shortHash,
									commitDetail.authorName && `${commitDetail.authorName}${commitDetail.authorEmail ? ` <${commitDetail.authorEmail}>` : ""}`,
									commitDetail.authoredAt && new Date(commitDetail.authoredAt).toLocaleString(),
									`${(commitDetail.files || []).length} file(s)`,
								].filter(Boolean).join(" · "),
								" · ",
								React.createElement("span", { className: "dg_statAdd" }, `+${commitDetail.additions || 0}`),
								" ",
								React.createElement("span", { className: "dg_statDel" }, `−${commitDetail.deletions || 0}`),
							),
						),
						commitDetail && React.createElement(
							PaneSplit,
							{
								className: "dg_historySplit",
								storageKey: "git.history-files",
								defaultRatio: 0.36,
								minFirst: 160,
								minSecond: 280,
							},
							React.createElement(
								"div",
								{ className: "dg_historyFiles" },
								!(commitDetail.files || []).length && React.createElement("div", { className: "dg_hint" }, "No file changes."),
								(commitDetail.files || []).map((f) =>
									React.createElement(
										"div",
										{
											key: f.path,
											className: "dg_row" + (historyFile?.path === f.path ? " dg_rowActive" : ""),
											onClick: () => openHistoryFile(f),
										},
										React.createElement("span", { className: "dg_badge" }, f.status || "M"),
										React.createElement("span", {
											style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
										}, f.path),
										React.createElement("span", {
											className: "dg_hint",
											style: { flex: "none", fontSize: 10 },
										}, f.binary
											? "bin"
											: React.createElement(React.Fragment, null,
												React.createElement("span", { className: "dg_statAdd" }, `+${f.additions || 0}`),
												"/",
												React.createElement("span", { className: "dg_statDel" }, `−${f.deletions || 0}`),
											)),
									),
								),
							),
							React.createElement(DiffView, {
								text: historyDiff,
								empty: historyBusy ? "Loading…" : "Select a file to see the diff.",
							}),
						),
					),
				),
				page === "changes" && status?.isRepo && (authorPromptOpen || needsAuthorSetup) && !allowDefaultAuthor && React.createElement(
					"div",
					{ className: "dg_authorPrompt" },
					React.createElement("div", { className: "dg_authorPromptTitle" }, "Set commit author"),
					React.createElement("div", { className: "dg_authorPromptHint" },
						"Commits are local but still need a name + email stamp. Save yours, or continue with the Harness default (Harness <harness@local>).",
					),
					React.createElement(
						"div",
						{ className: "dg_authorPromptRow" },
						React.createElement("input", {
							className: "dg_input",
							placeholder: "Name",
							value: authorNameDraft,
							disabled: busy,
							onChange: (e) => setAuthorNameDraft(e.target.value),
						}),
						React.createElement("input", {
							className: "dg_input",
							placeholder: "Email",
							value: authorEmailDraft,
							disabled: busy,
							onChange: (e) => setAuthorEmailDraft(e.target.value),
						}),
						React.createElement("button", {
							type: "button",
							className: "dg_btn dg_btnPrimary",
							disabled: busy || !authorNameDraft.trim() || !authorEmailDraft.trim(),
							onClick: () => saveAuthorIdentity({ commitAfter: Boolean(message.trim() && stagedCount > 0) }),
						}, message.trim() && stagedCount > 0 ? "Save & Commit" : "Save"),
						React.createElement("button", {
							type: "button",
							className: "dg_btn",
							disabled: busy,
							onClick: () => {
								setAllowDefaultAuthor(true);
								setAuthorPromptOpen(false);
								setInfo("Using Harness default author for this session. Change anytime in Settings → Git.");
							},
						}, "Use Harness default"),
					),
				),
				page === "changes" && status?.isRepo && React.createElement(
					"div",
					{ className: "dg_commit" },
					React.createElement("input", {
						className: "dg_input",
						placeholder: "Commit message",
						value: message,
						onChange: (e) => setMessage(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter" && message.trim() && stagedCount > 0) {
								requestCommit();
							}
						},
					}),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dg_btn dg_btnPrimary",
							disabled: busy || !message.trim() || stagedCount === 0,
							onClick: () => requestCommit(),
						},
						"Commit",
					),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dg_btn",
							disabled: busy || !status.canAmend || (stagedCount === 0 && !message.trim()),
							title: status.canAmend
								? "Amend last unpushed commit (add staged changes and/or change message)"
								: "Amend only works for an unpushed tip commit",
							onClick: () => doAmendCommit(),
						},
						"Amend",
					),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dg_btn",
							disabled: busy || !status.canUndo,
							title: status.canUndo
								? "Undo last unpushed commit (keeps changes staged)"
								: "Undo only works for an unpushed tip commit",
							onClick: () => doUndoCommit(),
						},
						"Undo",
					),
				),
				confirmModal && React.createElement(
					"div",
					{
						className: "dg_modalBackdrop",
						onClick: (e) => {
							if (e.target === e.currentTarget && !busy) setConfirmModal(null);
						},
					},
					React.createElement(
						"div",
						{ className: "dg_modal", role: "dialog", "aria-modal": "true" },
						React.createElement("div", { className: "dg_modalHead" }, confirmModal.title || "Confirm"),
						React.createElement(
							"div",
							{ className: "dg_modalBody" },
							confirmModal.type === "push" && confirmModal.preview && React.createElement(React.Fragment, null,
								React.createElement("div", null,
									`Remote: ${confirmModal.preview.remote || "origin"}`,
								),
								React.createElement("div", null,
									`Branch: ${confirmModal.preview.branch || "HEAD"} · ahead ${confirmModal.preview.ahead || 0}`
									+ (confirmModal.preview.behind ? ` · behind ${confirmModal.preview.behind}` : ""),
								),
								confirmModal.preview.dirty
									? React.createElement("div", { style: { color: "var(--dsw-alias-state-error-primary)" } },
										`Warning: ${confirmModal.preview.dirtyCount} uncommitted local change(s) will NOT be pushed. Only commits go to GitHub.`,
									)
									: null,
								(confirmModal.preview.commits || []).length === 0
									? React.createElement("div", null, "Nothing new to push (no local commits ahead of origin).")
									: React.createElement(React.Fragment, null,
										React.createElement("div", null, "Commits that will be pushed:"),
										React.createElement(
											"div",
											{ className: "dg_modalList" },
											confirmModal.preview.commits.map((c) =>
												React.createElement("div", { key: c.hash },
													`${c.hash}  ${c.subject}${c.authorName ? ` — ${c.authorName}` : ""}`,
												),
											),
										),
									),
							),
							confirmModal.type === "pull" && confirmModal.preview && React.createElement(React.Fragment, null,
								React.createElement("div", null,
									`Remote: ${confirmModal.preview.remote || "origin"} (fetched just now)`,
								),
								React.createElement("div", null,
									`Branch: ${confirmModal.preview.branch || "HEAD"} · behind ${confirmModal.preview.behind || 0}`
									+ (confirmModal.preview.ahead ? ` · ahead ${confirmModal.preview.ahead}` : ""),
								),
								confirmModal.preview.dirty
									? React.createElement("div", { style: { color: "var(--dsw-alias-state-error-primary)" } },
										`Warning: ${confirmModal.preview.dirtyCount} uncommitted local change(s) may block or mess up the pull. Prefer Discard first.`,
									)
									: null,
								(confirmModal.preview.commits || []).length === 0
									? React.createElement("div", null, "Already up to date — nothing new to pull.")
									: React.createElement(React.Fragment, null,
										React.createElement("div", null, "Commits that will come in:"),
										React.createElement(
											"div",
											{ className: "dg_modalList" },
											confirmModal.preview.commits.map((c) =>
												React.createElement("div", { key: c.hash },
													`${c.hash}  ${c.subject}${c.authorName ? ` — ${c.authorName}` : ""}`,
												),
											),
										),
									),
								(confirmModal.preview.files || []).length > 0
									? React.createElement(React.Fragment, null,
										React.createElement("div", null, `Files that will change (${confirmModal.preview.files.length}):`),
										React.createElement(
											"div",
											{ className: "dg_modalList" },
											confirmModal.preview.files.slice(0, 80).map((f) =>
												React.createElement("div", { key: f.path }, `${f.status}  ${f.path}`),
											),
											confirmModal.preview.files.length > 80
												? React.createElement("div", null, `…and ${confirmModal.preview.files.length - 80} more`)
												: null,
										),
									)
									: null,
							),
							confirmModal.type === "switchBranch" && React.createElement(React.Fragment, null,
								confirmModal.message && React.createElement("div", null, confirmModal.message),
								React.createElement("div", null, "What should happen to your uncommitted changes?"),
								React.createElement(
									"div",
									{ className: "dg_modeToggle", role: "group", "aria-label": "Dirty handling" },
									[["stash", "Stash"], ["bring", "Bring along"], ["discard", "Discard"]].map(([mode, label]) =>
										React.createElement("button", {
											key: mode,
											type: "button",
											className: (confirmModal.dirtyMode || "stash") === mode ? "dg_modeOn" : "",
											disabled: busy,
											onClick: () => setConfirmModal({ ...confirmModal, dirtyMode: mode }),
										}, label),
									),
								),
							),
							confirmModal.type === "createPr" && React.createElement(React.Fragment, null,
								React.createElement("div", null,
									`${confirmModal.head} → ${confirmModal.base}${confirmModal.draft ? " (draft)" : ""}`,
								),
								React.createElement("div", null, confirmModal.title),
								confirmModal.preview && React.createElement("div", null,
									`${confirmModal.preview.aheadBy || 0} commit(s), ${(confirmModal.preview.files || []).length} file(s)`,
								),
								(confirmModal.preview?.commits || []).length > 0 && React.createElement(
									"div",
									{ className: "dg_modalList" },
									confirmModal.preview.commits.slice(0, 20).map((c) =>
										React.createElement("div", { key: c.hash }, `${c.shortHash || c.hash}  ${c.subject}`),
									),
								),
							),
							confirmModal.type !== "push" && confirmModal.type !== "pull"
								&& confirmModal.type !== "switchBranch" && confirmModal.type !== "createPr"
								&& confirmModal.message
								? React.createElement("div", null, confirmModal.message)
								: null,
						),
						React.createElement(
							"div",
							{ className: "dg_modalActions" },
							React.createElement("button", {
								type: "button",
								className: "dg_btn",
								disabled: busy,
								onClick: () => setConfirmModal(null),
							}, "Cancel"),
							React.createElement("button", {
								type: "button",
								className: "dg_btn " + (
									confirmModal.type === "discardAll"
									|| confirmModal.type === "deleteBranch"
									|| (confirmModal.type === "pull" && confirmModal.preview?.dirty)
									|| (confirmModal.type === "switchBranch" && confirmModal.dirtyMode === "discard")
										? "dg_btnDanger"
										: "dg_btnPrimary"
								),
								disabled: busy
									|| (confirmModal.type === "push" && !(confirmModal.preview?.commits || []).length)
									|| (confirmModal.type === "pull" && !(confirmModal.preview?.commits || []).length),
								onClick: () => confirmModalAction(),
							}, confirmModal.type === "push"
								? "Push"
								: confirmModal.type === "pull"
									? (confirmModal.preview?.dirty ? "Pull anyway" : "Pull")
									: confirmModal.type === "switchBranch"
										? (confirmModal.prNumber ? "Checkout PR" : "Switch")
										: confirmModal.type === "deleteBranch"
											? "Delete"
											: confirmModal.type === "createPr"
												? "Create PR"
												: "Discard all"),
						),
					),
				),
			);
		}

		function GitSettings({ connection }) {
			const [token, setToken] = React.useState("");
			const [identity, setIdentity] = React.useState("");
			const [clientId, setClientId] = React.useState("");
			const [hasToken, setHasToken] = React.useState(false);
			const [hint, setHint] = React.useState("");
			const [login, setLogin] = React.useState("");
			const [authSource, setAuthSource] = React.useState("");
			const [userName, setUserName] = React.useState("");
			const [userEmail, setUserEmail] = React.useState("");
			const [commitName, setCommitName] = React.useState("");
			const [commitEmail, setCommitEmail] = React.useState("");
			const [status, setStatus] = React.useState(null);
			const [msg, setMsg] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [device, setDevice] = React.useState(null);
			const [showClientId, setShowClientId] = React.useState(false);
			const pollRef = React.useRef(null);

			React.useEffect(() => () => {
				if (pollRef.current) clearTimeout(pollRef.current);
			}, []);

			const reload = React.useCallback(async () => {
				if (!connection) return;
				try {
					const a = await callRpc(connection, "getAuth", {});
					setHasToken(Boolean(a.hasHttpsToken));
					setHint(a.httpsTokenHint || "");
					setIdentity(a.sshIdentityFile || "");
					setClientId(a.githubClientId || "");
					setLogin(a.githubLogin || "");
					setAuthSource(a.authSource || "");
					setUserName(a.userName || "");
					setUserEmail(a.userEmail || "");
					setCommitName(a.commitName || "");
					setCommitEmail(a.commitEmail || "");
				} catch (err) {
					setMsg(err.message);
				}
			}, [connection]);

			React.useEffect(() => {
				reload();
			}, [reload]);

			const save = async () => {
				setBusy(true);
				setMsg("");
				try {
					await callRpc(connection, "setAuth", {
						httpsToken: token.trim() || undefined,
						sshIdentityFile: identity.trim(),
						githubClientId: clientId.trim(),
						userName: userName.trim(),
						userEmail: userEmail.trim(),
					});
					setToken("");
					setMsg("Saved");
					await reload();
					notifyGitAuthChanged();
				} catch (err) {
					setMsg(err.message);
				} finally {
					setBusy(false);
				}
			};

			const clearToken = async () => {
				setBusy(true);
				setMsg("");
				try {
					await callRpc(connection, "setAuth", {
						clearHttpsToken: true,
						sshIdentityFile: identity.trim(),
						githubClientId: clientId.trim(),
						userName: userName.trim(),
						userEmail: userEmail.trim(),
					});
					setHasToken(false);
					setHint("");
					setLogin("");
					setAuthSource("");
					setDevice(null);
					setMsg("Signed out / token cleared");
					await reload();
					notifyGitAuthChanged();
				} catch (err) {
					setMsg(err.message);
				} finally {
					setBusy(false);
				}
			};

			const test = async () => {
				setBusy(true);
				setMsg("");
				try {
					const s = await callRpc(connection, "authStatus", {});
					setStatus(s);
					if (s.githubLogin) setLogin(s.githubLogin);
					if (s.hasHttpsToken) setHasToken(true);
				} catch (err) {
					setMsg(err.message);
				} finally {
					setBusy(false);
				}
			};

			const stopDevice = () => {
				if (pollRef.current) clearTimeout(pollRef.current);
				pollRef.current = null;
				setDevice(null);
			};

			const pollDevice = (deviceCode, intervalSec) => {
				if (pollRef.current) clearTimeout(pollRef.current);
				pollRef.current = setTimeout(async () => {
					try {
						const res = await callRpc(connection, "github.devicePoll", {
							deviceCode,
							clientId: clientId.trim() || undefined,
						});
						if (res.pending) {
							const next = res.slowDown ? Math.max(Number(res.interval) || intervalSec + 5, intervalSec) : intervalSec;
							setDevice((d) => (d ? { ...d, status: "Waiting for you to authorize…" } : d));
							pollDevice(deviceCode, next);
							return;
						}
						setDevice(null);
						setMsg(`Signed in as ${res.login || "GitHub user"}`);
						await reload();
						await test();
						notifyGitAuthChanged();
					} catch (err) {
						setDevice((d) => (d ? { ...d, status: err.message, failed: true } : d));
						setMsg(err.message);
					}
				}, Math.max(intervalSec, 5) * 1000);
			};

			/** Open GitHub device auth in the user's real browser tab — never the in-app Browser. */
			const openAuthInSystemBrowser = (uri) => {
				const url = String(uri || "").trim();
				if (!url) return false;
				try {
					const w = window.open(url, "_blank", "noopener,noreferrer");
					return Boolean(w);
				} catch {
					return false;
				}
			};

			const copyText = async (text) => {
				const value = String(text || "");
				if (!value) return false;
				try {
					if (navigator.clipboard?.writeText) {
						await navigator.clipboard.writeText(value);
						return true;
					}
				} catch { /* fall through */ }
				try {
					const ta = document.createElement("textarea");
					ta.value = value;
					ta.setAttribute("readonly", "");
					ta.style.position = "fixed";
					ta.style.left = "-9999px";
					document.body.appendChild(ta);
					ta.select();
					const ok = document.execCommand("copy");
					document.body.removeChild(ta);
					return ok;
				} catch {
					return false;
				}
			};

			const startDevice = async () => {
				setBusy(true);
				setMsg("");
				stopDevice();
				try {
					if (clientId.trim()) {
						await callRpc(connection, "setAuth", {
							githubClientId: clientId.trim(),
							sshIdentityFile: identity.trim(),
							userName: userName.trim(),
							userEmail: userEmail.trim(),
						});
					}
					const started = await callRpc(connection, "github.deviceStart", {
						clientId: clientId.trim() || undefined,
					});
					const uri = started.verificationUri || "https://github.com/login/device";
					const copied = await copyText(started.userCode);
					const opened = openAuthInSystemBrowser(uri);
					setDevice({
						userCode: started.userCode,
						verificationUri: uri,
						status: opened
							? (copied
								? "Code copied — paste it in the GitHub tab that just opened on your PC"
								: "Enter this code in the GitHub tab that just opened on your PC")
							: (copied
								? "Code copied — open GitHub on your PC browser and paste it"
								: "Open GitHub on your PC browser and enter this code"),
						failed: false,
					});
					pollDevice(started.deviceCode, Number(started.interval) || 5);
				} catch (err) {
					setMsg(err.message);
				} finally {
					setBusy(false);
				}
			};

			const field = {
				height: 32,
				borderRadius: 8,
				border: "1px solid var(--dsw-alias-border-l2)",
				padding: "0 10px",
				width: "100%",
				boxSizing: "border-box",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
			};

			return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 } },
				React.createElement("p", { style: { margin: 0, fontSize: 12, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 } },
					"Sign in with GitHub is only needed for listing remotes, clone/push/pull. Local init + commit work offline — commits just need a name/email stamp (below), not a cloud login."),
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "Commit author (local)"),
					React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 } },
						"Stored on each commit. No network. If empty and you’re signed in, we use your GitHub username + noreply email."),
					React.createElement("input", {
						value: userName,
						onChange: (e) => setUserName(e.target.value),
						placeholder: "Name (e.g. Jane Doe)",
						style: { ...field, marginBottom: 8 },
					}),
					React.createElement("input", {
						value: userEmail,
						onChange: (e) => setUserEmail(e.target.value),
						placeholder: "Email (can be anything local, e.g. you@local)",
						style: field,
					}),
					(commitName || commitEmail) && React.createElement("p", {
						style: { margin: "8px 0 0", fontSize: 11, color: "var(--dsw-alias-label-tertiary)", fontFamily: "var(--ds-font-family-code)" },
					}, `Currently used: ${commitName || "?"} <${commitEmail || "?"}>`),
				),
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "Sign in with GitHub"),
					React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 } },
						"One-time: create an OAuth App at github.com/settings/developers → OAuth Apps → New. Any Homepage URL is fine (e.g. http://127.0.0.1). Enable ",
						React.createElement("strong", null, "Device Flow"),
						", then paste the Client ID below. No client secret needed for device flow."),
					React.createElement("div", {
						style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
					},
						React.createElement("input", {
							type: showClientId ? "text" : "password",
							value: clientId,
							onChange: (e) => setClientId(e.target.value),
							placeholder: "GitHub OAuth App Client ID (Ov…)",
							autoComplete: "off",
							style: { ...field, flex: 1, fontFamily: "var(--ds-font-family-code)", fontSize: 12 },
						}),
						React.createElement("button", {
							type: "button",
							title: showClientId ? "Hide Client ID" : "Show Client ID",
							"aria-label": showClientId ? "Hide Client ID" : "Show Client ID",
							onClick: () => setShowClientId((v) => !v),
							style: {
								height: 32,
								width: 36,
								flex: "none",
								borderRadius: 8,
								border: "1px solid var(--dsw-alias-border-l2)",
								background: "var(--dsw-alias-bg-layer-2)",
								cursor: "pointer",
								fontSize: 16,
								lineHeight: 1,
							},
						}, showClientId ? "🙈" : "👁"),
					),
					hasToken && React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12 } },
						`Connected${login ? ` as ${login}` : ""}${authSource ? ` (${authSource})` : ""}.`),
					React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
						React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: startDevice,
							style: { height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer" },
						}, busy && !device ? "Starting…" : "Sign in with GitHub"),
						hasToken && React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: clearToken,
							style: { height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer" },
						}, "Sign out"),
						React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: save,
							style: { height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer" },
						}, "Save Client ID"),
					),
					device && React.createElement("div", {
						style: {
							marginTop: 12,
							padding: "12px 14px",
							border: "1px dashed var(--dsw-alias-border-l2)",
							borderRadius: 10,
							background: "var(--dsw-alias-bg-layer-1)",
							display: "flex",
							flexDirection: "column",
							gap: 8,
						},
					},
						React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, device.status),
						React.createElement("div", {
							style: {
								fontFamily: "var(--ds-font-family-code)",
								fontSize: 22,
								letterSpacing: "0.12em",
								fontWeight: 700,
							},
						}, device.userCode),
						React.createElement("p", {
							style: { margin: 0, fontSize: 12, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 },
						}, "Authorize in your PC browser (Chrome/Edge/etc) — not the Harness Browser tab."),
						React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
							React.createElement("button", {
								type: "button",
								onClick: async () => {
									const ok = await copyText(device.userCode);
									setDevice((d) => (d ? { ...d, status: ok ? "Code copied" : "Couldn’t copy — select the code manually" } : d));
								},
								style: { height: 28, borderRadius: 8, padding: "0 10px", cursor: "pointer" },
							}, "Copy code"),
							React.createElement("button", {
								type: "button",
								onClick: () => {
									const ok = openAuthInSystemBrowser(device.verificationUri);
									setDevice((d) => (d ? {
										...d,
										status: ok
											? "Opened GitHub in your browser — paste the code there"
											: "Popup blocked — open github.com/login/device manually",
									} : d));
								},
								style: { height: 28, borderRadius: 8, padding: "0 10px", cursor: "pointer" },
							}, "Open GitHub in your browser"),
							React.createElement("button", {
								type: "button",
								onClick: stopDevice,
								style: { height: 28, borderRadius: 8, padding: "0 10px", cursor: "pointer" },
							}, "Cancel"),
						),
					),
				),
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "SSH identity (optional)"),
					React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },
						"Path inside the Harness container to a private key (e.g. /home/node/.ssh/id_ed25519). Leave empty to use the default ssh agent/keys."),
					React.createElement("input", {
						value: identity,
						onChange: (e) => setIdentity(e.target.value),
						placeholder: "/home/node/.ssh/id_ed25519",
						style: { ...field, fontFamily: "var(--ds-font-family-code)", fontSize: 12 },
					}),
				),
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "HTTPS token / PAT (optional)"),
					React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },
						hasToken
							? `A token is saved (${hint || "••••"}). Paste a new one to replace, or Sign out above.`
							: "Fallback if you prefer a classic/fine-grained PAT with repo scope instead of device Sign in."),
					React.createElement("input", {
						type: "password",
						value: token,
						onChange: (e) => setToken(e.target.value),
						placeholder: hasToken ? "••••••••  (paste to replace)" : "ghp_…",
						autoComplete: "off",
						style: field,
					}),
				),
				React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
					React.createElement("button", {
						type: "button",
						disabled: busy,
						onClick: save,
						style: { height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer" },
					}, "Save"),
					React.createElement("button", {
						type: "button",
						disabled: busy,
						onClick: test,
						style: { height: 32, borderRadius: 8, padding: "0 12px", cursor: "pointer" },
					}, "Test auth"),
				),
				status && React.createElement("div", { style: { fontSize: 12, lineHeight: 1.5 } },
					React.createElement("div", null, `SSH: ${status.ssh?.ok ? `OK${status.ssh.login ? ` as ${status.ssh.login}` : ""}` : "failed"} — ${status.ssh?.detail || ""}`),
					React.createElement("div", null, `HTTPS: ${status.https?.ok ? `OK${status.https.login ? ` as ${status.https.login}` : ""}` : "not configured / failed"} — ${status.https?.detail || ""}`),
				),
				msg && React.createElement("div", { style: { fontSize: 12 } }, msg),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			ctx.effect(
				() =>
					ctx.slots.inject("conversation.view", () =>
						ctx.slots.register(
							{
								name: "conversation.view",
								id: "git",
								order: 6,
								label: () => "Git",
								inject: (sessionId) => ({ sessionId, connection }),
							},
							GitView,
						),
					),
				`${PLUGIN}: tab`,
			);

			ctx.effect(() => {
				window.__dshHeroToolRegistry = window.__dshHeroToolRegistry || {
					_map: new Map(),
					register(id, factory) {
						this._map.set(id, factory);
						return () => this._map.delete(id);
					},
					get(id) {
						return this._map.get(id);
					},
				};
				return window.__dshHeroToolRegistry.register("git", (opts) => {
					let sid = opts?.sessionId || null;
					if (!sid) {
						try {
							const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
							sid = parsed?.sessionId || null;
						} catch {
							/* ignore */
						}
					}
					return React.createElement(GitView, { connection, sessionId: sid });
				});
			}, `${PLUGIN}: workbench panel`);

			try {
				ctx.slots.inject(
					"settings.section",
					() =>
						ctx.slots.register(
							{
								name: "settings.section",
								id: "git",
								order: 188,
								label: () => "Git",
								inject: () => ({ connection }),
							},
							GitSettings,
						),
					`${PLUGIN}: settings`,
				);
			} catch (err) {
				console.warn(`[${PLUGIN}] settings inject failed`, err);
			}
		}

		return { apply, inject };
	},
});
