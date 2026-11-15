const STORAGE_KEY='pinkPlateMessTracker.v1';
const MEALS=['Breakfast','Lunch','Dinner'];
const $=s=>document.querySelector(s);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asMonth=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const asDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function freshStore(){return {residents:[],meals:{},payments:[],expenses:[],months:{},migrationV2:true}}
function readStore(){
 try{
  const old=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!old)return freshStore();
  const s={...freshStore(),...old};s.residents||=[];s.meals||={};s.payments||=[];s.expenses||=[];s.months||={};
  if(!s.migrationV2){
   for(const [month,v] of Object.entries(s.months)){if(!/^\d{4}-\d{2}$/.test(month))continue;const date=`${month}-01`;
    if(Number(v.expenses)>0)s.expenses.push({id:uid(),date,description:'Previous monthly expenses',amount:Number(v.expenses),createdAt:new Date().toISOString()});
    for(const [residentId,amount] of Object.entries(v.payments||{}))if(Number(amount)>0)s.payments.push({id:uid(),residentId,date,amount:Number(amount),description:'Previous monthly payment',createdAt:new Date().toISOString()});
   }
   s.migrationV2=true;
  }
  return s;
 }catch{return freshStore()}
}
let store=readStore();
let selectedMonth=asMonth(new Date()),selectedDate=asDate(new Date()),currentPage='dashboard',batchItems=[],activePollId=null,residentEditingId=null,reviewingPollId=null,reviewingLineId=null;
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));toast('Saved on this device')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1700)}
function dateLabel(s,opts={day:'numeric',month:'short',year:'numeric'}){return new Date(`${s}T12:00:00`).toLocaleDateString(undefined,opts)}
function monthLabel(){return new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}
function cash(n){return `₹${(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function monthStart(){return `${selectedMonth}-01`}
function monthEnd(){const [y,m]=selectedMonth.split('-').map(Number);return new Date(y,m,0).getDate()}
function dayKeys(){return Array.from({length:monthEnd()},(_,i)=>`${selectedMonth}-${String(i+1).padStart(2,'0')}`)}
function mealKey(date,meal){return `${date}|${meal}`}
function record(date,meal){return store.meals[mealKey(date,meal)]||{attendees:[],unknownVoters:[],ignoredOcrLines:[]}}
function unitsFor(date,meal,id){return (record(date,meal).attendees||[]).find(a=>a.id===id)?.units||0}
function residentDaily(id,date){return MEALS.reduce((n,m)=>n+unitsFor(date,m,id),0)}
function dailyTotal(date){return store.residents.reduce((n,r)=>n+residentDaily(r.id,date),0)}
function residentMonth(id){return dayKeys().reduce((n,d)=>n+residentDaily(id,d),0)}
function monthMeals(){return dayKeys().reduce((n,d)=>n+dailyTotal(d),0)}
function mealBreakdown(date){return Object.fromEntries(MEALS.map(m=>[m,store.residents.reduce((n,r)=>n+unitsFor(date,m,r.id),0)]))}
function monthPayments(){return store.payments.filter(p=>p.date?.startsWith(selectedMonth)&&!p.voided)}
function monthExpenses(){return store.expenses.filter(e=>e.date?.startsWith(selectedMonth)&&!e.voided)}
function collections(){return monthPayments().reduce((n,p)=>n+Number(p.amount||0),0)}
function expensesTotal(){return monthExpenses().reduce((n,e)=>n+Number(e.amount||0),0)}
function rate(){return monthMeals()?expensesTotal()/monthMeals():0}
function active(){return store.residents.filter(r=>r.active!==false)}
function peopleForHistory(){const ids=new Set([...Object.values(store.meals).flatMap(x=>(x.attendees||[]).map(a=>a.id)),...store.payments.map(p=>p.residentId)]);return store.residents.filter(r=>r.active!==false||ids.has(r.id))}
function initials(n){return n.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')}
function empty(title,copy){return `<div class="empty"><strong>${title}</strong>${copy}</div>`}
function header(tag,title,copy,action=''){return `<div class="title-row"><div><p class="eyebrow">${tag}</p><h1 class="page-title">${title}</h1><p class="subhead">${copy}</p></div>${action}</div>`}
function setPage(page){currentPage=page;renderAll()}
function renderDashboard(){
 const today=asDate(new Date()),summary=mealBreakdown(today),todayTotal=Object.values(summary).reduce((a,b)=>a+b,0);
 const recent=Object.entries(store.meals).sort(([a],[b])=>b.localeCompare(a)).slice(0,6);
 $('#page-dashboard').innerHTML=`${header('YOUR MESS AT A GLANCE','Dashboard',`A live snapshot of ${monthLabel()}. Your daily entries update these numbers as you go.`)}
 <div class="stats"><div class="stat"><div class="stat-label">THIS MONTH'S MEALS</div><div class="stat-value">${monthMeals().toLocaleString(undefined,{maximumFractionDigits:1})}</div><div class="stat-note">Confirmed meal units</div></div><div class="stat"><div class="stat-label">TODAY'S MEALS</div><div class="stat-value">${todayTotal.toLocaleString(undefined,{maximumFractionDigits:1})}</div><div class="stat-note">B ${summary.Breakfast} · L ${summary.Lunch} · D ${summary.Dinner}</div></div><div class="stat"><div class="stat-label">REGISTERED RESIDENTS</div><div class="stat-value">${active().length}</div><div class="stat-note">Active in the household</div></div><div class="stat"><div class="stat-label">PAYMENTS COLLECTED</div><div class="stat-value">${cash(collections())}</div><div class="stat-note">${monthPayments().length} payment records</div></div><div class="stat"><div class="stat-label">TOTAL EXPENSES</div><div class="stat-value">${cash(expensesTotal())}</div><div class="stat-note">${monthExpenses().length} expense records</div></div><div class="stat"><div class="stat-label">MEAL RATE</div><div class="stat-value">${cash(rate())}</div><div class="stat-note">Expenses ÷ meal units</div></div></div>
 <div class="dashboard-columns"><div class="card"><div class="card-head"><div><h2>Today's meal counts</h2><p>${dateLabel(today)}</p></div><button class="btn btn-secondary btn-small" data-goto-daily="${today}">Open daily tracker</button></div><div class="table-wrap"><table><thead><tr><th>Meal</th><th>Resident count</th></tr></thead><tbody>${MEALS.map(m=>`<tr><td class="table-name">${m}</td><td class="amount">${summary[m].toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="card"><div class="card-head"><div><h2>Recent meal records</h2><p>Latest saved daily entries</p></div><button class="btn btn-secondary btn-small" data-page-link="monthly">Monthly overview</button></div><div class="table-wrap">${recent.length?`<table><thead><tr><th>Date</th><th>Meal</th><th>Units</th></tr></thead><tbody>${recent.map(([k,v])=>{const [d,m]=k.split('|');const total=(v.attendees||[]).reduce((n,a)=>n+Number(a.units||0),0);return `<tr><td>${dateLabel(d)}</td><td>${esc(m)}</td><td class="amount">${total.toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr>`}).join('')}</tbody></table>`:empty('No meals yet','Add a daily meal entry or import a poll screenshot.')}</div></div></div>`;
 $('#page-dashboard').querySelectorAll('[data-goto-daily]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.gotoDaily;setPage('daily')});
 $('#page-dashboard').querySelectorAll('[data-page-link]').forEach(b=>b.onclick=()=>setPage(b.dataset.pageLink));
}
function openResidentDialog(resident=null){residentEditingId=resident?.id||null;$('#residentForm').reset();$('#residentFormError').textContent='';$('#residentDialogTitle').textContent=resident?'Edit resident':'Add a resident';$('#residentName').value=resident?.name||'';$('#residentAliases').value=Array.isArray(resident?.aliases)?resident.aliases.join(', '):String(resident?.aliases||'');$('#residentDialog').showModal();$('#residentName').focus()}
function renderResidents(){
 const list=active();
 $('#page-residents').innerHTML=`${header('YOUR HOUSEHOLD','Residents','Keep each hostel resident registered by their full name. Poll matching uses their first name.',`<button class="btn btn-primary" id="addResident">＋ Add resident</button>`)}
 <div class="stats"><div class="stat"><div class="stat-label">ACTIVE RESIDENTS</div><div class="stat-value">${list.length}</div><div class="stat-note">Registered for this month</div></div><div class="stat"><div class="stat-label">MEAL UNITS THIS MONTH</div><div class="stat-value">${monthMeals()}</div><div class="stat-note">Across all residents</div></div><div class="stat"><div class="stat-label">MEAL RATE</div><div class="stat-value">${cash(rate())}</div><div class="stat-note">Current month's expenses</div></div></div>
 <div class="card"><div class="card-head"><div><h2>Registered residents</h2><p>Full name is kept on the record; the first name is used as the primary poll match.</p></div><span class="pill">${list.length} ACTIVE</span></div><div class="card-body">${list.length?`<div class="resident-grid">${list.map(r=>`<div class="resident-card"><div class="avatar">${esc(initials(r.name))}</div><div class="resident-info"><div class="resident-name">${esc(r.name)}</div><div class="resident-meta">${residentMonth(r.id)} meal units · ${cash(residentMonth(r.id)*rate())} charge</div></div><div class="resident-controls"><button class="btn btn-secondary btn-small" data-edit-resident="${r.id}">Edit</button><button class="btn btn-secondary btn-small danger" data-delete-resident="${r.id}">Remove</button></div></div>`).join('')}</div>`:empty('A fresh start','Add residents to begin tracking meals.')}</div></div>
 ${store.residents.some(r=>r.active===false)?`<div class="card"><div class="card-head"><h2>Removed residents</h2><span class="pill pill-gray">HISTORY KEPT</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Month meals</th><th>Action</th></tr></thead><tbody>${store.residents.filter(r=>r.active===false).map(r=>`<tr><td>${esc(r.name)}</td><td>${residentMonth(r.id)}</td><td><button class="btn btn-secondary btn-small" data-restore-resident="${r.id}">Restore</button></td></tr>`).join('')}</tbody></table></div></div>`:''}
 <div class="callout">Removing a resident hides them from new records while keeping their earlier meal and payment history.</div>`;
 $('#addResident').onclick=()=>openResidentDialog();
 $('#page-residents').querySelectorAll('[data-edit-resident]').forEach(b=>b.onclick=()=>openResidentDialog(store.residents.find(r=>r.id===b.dataset.editResident)));
 $('#page-residents').querySelectorAll('[data-delete-resident]').forEach(b=>b.onclick=()=>{const r=store.residents.find(x=>x.id===b.dataset.deleteResident);if(r){r.active=false;save();renderAll()}});
 $('#page-residents').querySelectorAll('[data-restore-resident]').forEach(b=>b.onclick=()=>{const r=store.residents.find(x=>x.id===b.dataset.restoreResident);if(r){r.active=true;save();renderAll()}});
}
function bindResidentDialog(){
 $('#cancelResident').onclick=()=>$('#residentDialog').close();
 $('#residentForm').onsubmit=e=>{e.preventDefault();const name=$('#residentName').value.trim(),error=$('#residentFormError');error.textContent='';if(!name){error.textContent='Enter a full resident name.';return}
  const duplicate=store.residents.find(r=>r.active!==false&&r.id!==residentEditingId&&r.name.toLowerCase()===name.toLowerCase());if(duplicate){error.textContent='That resident is already registered.';return}
  const aliases=[...new Map($('#residentAliases').value.split(',').map(x=>x.trim()).filter(Boolean).map(alias=>[normalizeName(alias),alias])).values()];
  if(residentEditingId){const r=store.residents.find(x=>x.id===residentEditingId);if(r){r.name=name;r.aliases=aliases}}else store.residents.push({id:uid(),name,aliases,active:true,createdAt:new Date().toISOString()});save();$('#residentDialog').close();renderAll();
 };
}
function mealEditor(date,meal){
 const rec=record(date,meal),people=store.residents.filter(r=>r.active!==false||unitsFor(date,meal,r.id)>0);
 const rows=people.length?people.map(r=>`<div class="adjust-row"><span class="table-name">${esc(r.name)}</span><button type="button" class="stepper-btn" data-step="-0.5" data-resident="${r.id}" data-meal="${meal}" aria-label="Subtract half a meal from ${esc(r.name)}">−</button><input class="meal-units" type="number" min="0" step="0.5" value="${unitsFor(date,meal,r.id)}" data-units="${r.id}" data-meal="${meal}" aria-label="${esc(r.name)} ${meal} units"><button type="button" class="stepper-btn" data-step="0.5" data-resident="${r.id}" data-meal="${meal}" aria-label="Add half a meal for ${esc(r.name)}">＋</button><small>+ / − in 0.5 steps</small></div>`).join(''):empty('No residents','Add residents first.');
 const unknown=rec.unknownVoters||[];
 return `<div class="card meal-editor" data-editor-meal="${meal}"><div class="card-head"><div><h2>${meal}</h2><p>${(rec.attendees||[]).length} residents · ${mealUnits(rec).toLocaleString(undefined,{maximumFractionDigits:1})} meal units</p></div><span class="pill ${rec.updatedAt?'pill-green':'pill-gray'}">${rec.updatedAt?'SAVED':'NOT SAVED'}</span></div><div class="card-body"><div class="adjust-list">${rows}</div><div class="toolbar" style="margin-top:13px"><button class="btn btn-primary" data-save-meal="${meal}">Save ${meal.toLowerCase()}</button><span class="detail-line">Saved daily to this browser</span></div>${unknown.length?`<div class="unknown-saved"><strong>Unknown voters · not counted</strong>${unknown.map((u,i)=>`<div class="unknown-resolve"><span>${esc(u.text)} <small>· ${esc(u.source||'OCR')}</small></span><div class="unknown-actions"><select data-resolve-select="${meal}|${i}" aria-label="Match ${esc(u.text)} to a resident"><option value="">Choose resident</option>${active().map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select><button type="button" class="btn btn-secondary btn-small" data-confirm-unknown="${meal}|${i}" disabled>Confirm match</button><button type="button" class="text-button" data-not-voter="${meal}|${i}">Not a voter</button></div></div>`).join('')}</div>`:''}</div></div>`;
}
function mealUnits(rec){return (rec.attendees||[]).reduce((n,a)=>n+Number(a.units||0),0)}
function addPollScreenshots(files){
 const images=files.filter(file=>file.type?.startsWith('image/')||/\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name||''));if(!images.length){if(files.length)toast('Choose image screenshots');return}
 for(const file of images){const item={id:uid(),file,fileName:file.name,previewUrl:URL.createObjectURL(file),date:$('#batchDate').value||selectedDate,meal:$('#batchMeal').value,status:'ready',rawText:'',lines:[],activeTab:'extracted'};batchItems.push(item);if(!activePollId)activePollId=item.id}
 $('#batchStatus').textContent=`${images.length} screenshot${images.length===1?'':'s'} added. Set each date and meal, then read them.`;if(batchItems.length&&!$('#batchDialog').open)$('#batchDialog').showModal();renderBatchArea();
}
function renderDaily(){
 const breakdown=mealBreakdown(selectedDate),batchCount=batchItems.length;
 $('#page-daily').innerHTML=`${header('DAILY LOG','Daily meals',`Track breakfast, lunch and dinner for ${dateLabel(selectedDate)}. You can set a count directly or adjust it in half-meal steps.`,`<span class="pill">${dailyTotal(selectedDate).toLocaleString(undefined,{maximumFractionDigits:1})} MEAL UNITS</span>`)}
 <div class="daily-toolbar card"><div class="field"><label for="dailyDate">TRACKING DATE</label><input type="date" id="dailyDate" value="${selectedDate}"></div><div class="daily-counts">${MEALS.map(m=>`<div><small>${m.toUpperCase()}</small><strong>${breakdown[m].toLocaleString(undefined,{maximumFractionDigits:1})}</strong></div>`).join('')}<div><small>DAILY TOTAL</small><strong>${dailyTotal(selectedDate).toLocaleString(undefined,{maximumFractionDigits:1})}</strong></div></div></div>
 <div class="daily-grid">${MEALS.map(m=>mealEditor(selectedDate,m)).join('')}</div>
 <div class="card"><div class="card-head"><div><h2>Resident totals for ${dateLabel(selectedDate)}</h2><p>Daily and meal-by-meal counts.</p></div><span class="pill">${dailyTotal(selectedDate).toLocaleString(undefined,{maximumFractionDigits:1})} TOTAL</span></div><div class="table-wrap"><table><thead><tr><th>Resident</th>${MEALS.map(m=>`<th>${m}</th>`).join('')}<th>Daily total</th></tr></thead><tbody>${active().length?active().map(r=>`<tr><td class="table-name">${esc(r.name)}</td>${MEALS.map(m=>`<td>${unitsFor(selectedDate,m,r.id).toLocaleString(undefined,{maximumFractionDigits:1})}</td>`).join('')}<td class="amount">${residentDaily(r.id,selectedDate).toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr>`).join(''):`<tr><td colspan="5">${empty('No residents yet','Add residents first.')}</td></tr>`}</tbody></table></div></div>
 <div class="card" id="pollImport"><div class="card-head"><div><h2>WhatsApp poll screenshots</h2><p>Upload multiple poll screenshots, review every extracted line, then apply them together.</p></div><span class="pill">${batchCount} IN REVIEW</span></div><div class="card-body"><div class="ocr-upload-controls"><div class="field"><label for="batchDate">DEFAULT DATE</label><input type="date" id="batchDate" value="${selectedDate}"></div><div class="field"><label for="batchMeal">DEFAULT MEAL</label><select id="batchMeal">${MEALS.map(m=>`<option>${m}</option>`).join('')}</select></div><label class="upload-box compact-upload poll-dropzone" id="pollDropZone" for="pollFiles"><input id="pollFiles" type="file" accept="image/*" multiple><span class="upload-icon">⇧</span><strong>Add screenshot(s)</strong><small>Click to choose or drag image files here</small></label></div>
 <div id="batchStatus" class="detail-line" style="margin:12px 0"></div></div></div>`;
 $('#dailyDate').onchange=e=>{selectedDate=e.target.value||asDate(new Date());renderAll()};
 $('#page-daily').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const input=$(`[data-units="${b.dataset.resident}"][data-meal="${b.dataset.meal}"]`);input.value=Math.max(0,(Number(input.value)||0)+Number(b.dataset.step))});
 $('#page-daily').querySelectorAll('[data-save-meal]').forEach(b=>b.onclick=()=>{
  const meal=b.dataset.saveMeal,attendees=[];
  $(`.meal-editor[data-editor-meal="${meal}"]`).querySelectorAll('[data-units]').forEach(input=>{const units=Math.max(0,Math.round((Number(input.value)||0)*2)/2);if(units>0)attendees.push({id:input.dataset.units,units})});
  const key=mealKey(selectedDate,meal),previous=store.meals[key]||{};store.meals[key]={...previous,attendees,updatedAt:new Date().toISOString()};save();renderAll();
 });
 $('#page-daily').querySelectorAll('[data-resolve-select]').forEach(select=>select.onchange=()=>{$(`[data-confirm-unknown="${select.dataset.resolveSelect}"]`).disabled=!select.value});
 $('#page-daily').querySelectorAll('[data-confirm-unknown]').forEach(button=>button.onclick=()=>{const [meal,index]=button.dataset.confirmUnknown.split('|'),rec=store.meals[mealKey(selectedDate,meal)],unknown=rec?.unknownVoters?.[Number(index)],select=$(`[data-resolve-select="${button.dataset.confirmUnknown}"]`);if(!unknown||!select?.value)return;const current=rec.attendees.find(a=>a.id===select.value);if(current)current.units=Number(current.units||0)+1;else rec.attendees.push({id:select.value,units:1});rec.unknownVoters.splice(Number(index),1);rec.updatedAt=new Date().toISOString();save();renderAll()});
 $('#page-daily').querySelectorAll('[data-not-voter]').forEach(button=>button.onclick=()=>{const [meal,index]=button.dataset.notVoter.split('|'),rec=store.meals[mealKey(selectedDate,meal)];if(!rec?.unknownVoters?.[Number(index)])return;const [line]=rec.unknownVoters.splice(Number(index),1);rec.ignoredOcrLines||=[];rec.ignoredOcrLines.push(line);rec.updatedAt=new Date().toISOString();save();renderAll()});
 const dropZone=$('#pollDropZone'),pollInput=$('#pollFiles');pollInput.onchange=e=>{addPollScreenshots([...e.target.files||[]]);e.target.value=''};
 let dragDepth=0;dropZone.ondragenter=e=>{e.preventDefault();dragDepth++;dropZone.classList.add('drag-over')};dropZone.ondragover=e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy'};dropZone.ondragleave=e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)dropZone.classList.remove('drag-over')};dropZone.ondrop=e=>{e.preventDefault();e.stopPropagation();dragDepth=0;dropZone.classList.remove('drag-over');addPollScreenshots([...e.dataTransfer.files||[]])};
 $('#processPolls').onclick=processBatch;
 $('#clearPolls').onclick=()=>{batchItems.forEach(item=>URL.revokeObjectURL(item.previewUrl));batchItems=[];activePollId=null;$('#batchDialog').close();renderAll()};
 bindBatchReview();
}
function renderBatchMarkup(){
 if(!batchItems.length)return '';
 const item=batchItems.find(x=>x.id===activePollId)||batchItems[0];activePollId=item.id;
 const matched=item.lines.filter(x=>x.state==='matched').length,unknown=item.lines.filter(x=>x.state==='unknown'||x.state==='pending').length,unresolved=item.lines.filter(x=>!x.reviewed||!['matched','unknown','ignored'].includes(x.state)).length,activeTab=item.activeTab||'extracted';
 const visibleLines=item.lines.map((line,index)=>({line,index})).filter(({line})=>activeTab==='extracted'||(activeTab==='polls'&&line.state!=='ignored')||(activeTab==='matched'&&line.state==='matched')||(activeTab==='unknown'&&['unknown','pending'].includes(line.state)));
 const tabs=[['polls','Poll Votes',item.lines.filter(x=>x.state!=='ignored').length],['extracted','Extracted Names',item.lines.length],['matched','Matched',matched],['unknown','Unknown',unknown],['debug','Debug Crops',(item.debugCrops||[]).length]];
 return `<div class="batch-source-tabs">${batchItems.map((x,i)=>`<button type="button" class="batch-source-tab ${x.id===item.id?'active':''}" data-source-poll="${x.id}" title="${esc(x.fileName)}">Screenshot ${i+1}<span>${x.status==='read'?x.lines.length:'…'}</span></button>`).join('')}</div><div class="poll-card" data-poll="${item.id}"><div class="poll-card-head"><div><strong title="${esc(item.fileName)}">${esc(item.fileName)}</strong><div class="detail-line">${item.status==='read'?`OCR read · ${item.lines.length} extracted voters${item.mealHeading?` · heading: ${esc(item.mealHeading)}`:''}`:item.status==='reading'?'Reading screenshot…':'Ready to read'}</div></div><button type="button" class="text-button danger" data-remove-poll="${item.id}">Remove</button></div><div class="poll-meta"><div class="field"><label>DATE</label><input type="date" data-poll-date="${item.id}" value="${item.date}"></div><div class="field"><label>MEAL</label><select data-poll-meal="${item.id}">${MEALS.map(m=>`<option ${item.meal===m?'selected':''}>${m}</option>`).join('')}</select></div></div>
 <div class="poll-review-layout"><aside class="poll-image-panel" aria-label="Uploaded poll screenshot"><div class="poll-image-title"><strong>Uploaded poll</strong><span>Compare names with the screenshot</span></div><div class="poll-image-viewport"><img src="${esc(item.previewUrl)}" alt="Uploaded WhatsApp poll: ${esc(item.fileName)}"></div></aside><section class="poll-review-results" aria-label="OCR review">${item.status==='read'?`<div class="voter-list-heading"><div><h3>Extracted voters</h3><p>${unresolved?`${unresolved} entries need review before this poll can be applied.`:'All entries reviewed; matches still require final apply.'}</p></div><button type="button" class="btn btn-secondary btn-small" data-add-missing="${item.id}">＋ Add Missing Voter</button></div><div class="voter-tabs">${tabs.map(([key,label,count])=>`<button type="button" class="voter-tab ${activeTab===key?'active':''}" data-voter-tab="${item.id}|${key}">${label}<span>${count}</span></button>`).join('')}</div>${activeTab==='debug'?`<div class="debug-crops">${(item.debugCrops||[]).length?item.debugCrops.map((src,i)=>`<figure><img src="${src}" alt="Debug crop ${i+1}"><figcaption>Detected voter list · crop ${i+1}</figcaption></figure>`).join(''):empty('No voter-list crop detected','The OCR lines did not form a timestamped response area. Check full OCR text and add missing voters manually.')}</div>`:`<div class="voter-list">${visibleLines.length?visibleLines.map(({line,index})=>renderPollLine(item,line,index)).join(''):empty('No voter names found','Check Debug Crops and full OCR text, or add a missing voter manually.')}</div>`}<details class="raw-ocr"><summary>View full OCR text</summary><pre>${esc(item.rawText)}</pre></details>`:`<div class="callout">${item.status==='reading'?'OCR is reading text and locating poll response rows…':'The screenshot will be OCR-read locally in your browser. Voter rows are identified using OCR text and image coordinates.'}</div>`}</section></div>${item.date&&item.meal&&store.meals[mealKey(item.date,item.meal)]?`<label class="replace-warning"><input type="checkbox" data-replace="${item.id}" ${item.replaceExisting?'checked':''}> Replace existing ${esc(item.meal)} record for ${dateLabel(item.date)} when applying</label>`:''}</div>`;
}
function normalizeName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function editDistance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return row[b.length]}
function matchSuggestions(text){
 const raw=normalizeName(text),tokens=raw.split(' ').filter(Boolean);if(!raw)return [];
 const scored=store.residents.filter(r=>r.active!==false).map(r=>{let score=0;const names=[r.name,...(Array.isArray(r.aliases)?r.aliases:typeof r.aliases==='string'?r.aliases.split(','):[])].map(normalizeName).filter(Boolean);
  for(const name of names){const parts=name.split(' '),first=parts[0]||'',targetFirst=tokens[0]||'';
   if(raw===name)score=Math.max(score,1);
   else if(targetFirst===first)score=Math.max(score,.95);
   else if(targetFirst.length>=4&&first.length>=4){const similarity=1-editDistance(targetFirst,first)/Math.max(targetFirst.length,first.length);if(similarity>=.78)score=Math.max(score,.82+similarity*.14)}
   if(tokens.length>1&&parts.length>1&&tokens.at(-1)===parts.at(-1)&&targetFirst.length===1&&targetFirst===first[0])score=Math.max(score,.84);
  }
  return {r,score};
 }).filter(x=>x.score>=.84).sort((a,b)=>b.score-a.score);
 if(!scored.length)return [];
 const top=scored[0].score;return scored.filter(x=>x.score>=top-.025).map(x=>x.r);
}
function confidentResidentMatch(text,confidence){
 const name=normalizeName(text);if(!name||confidence<70)return null;
 const residents=store.residents.filter(r=>r.active!==false),names=r=>[r.name,...(Array.isArray(r.aliases)?r.aliases:typeof r.aliases==='string'?r.aliases.split(','):[])].map(normalizeName).filter(Boolean);
 const exact=residents.filter(r=>names(r).includes(name));if(exact.length===1)return exact[0];if(exact.length>1)return null;
 const first=name.split(' ')[0];if(first.length<2)return null;
 const firstMatches=residents.filter(r=>names(r).some(n=>n.split(' ')[0]===first));
 return firstMatches.length===1?firstMatches[0]:null;
}
function cleanVoterName(raw){
 let text=String(raw||'').normalize('NFKC').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ').replace(/\s+/g,' ').trim();
 const phone=text.replace(/[()\s-]/g,'');if(/^\+?\d{8,15}$/.test(phone))return text;
 text=text.replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();
 while(/^(?:[\p{L}\d])\s+(?=\p{L})/u.test(text))text=text.replace(/^(?:[\p{L}\d])\s+(?=\p{L})/u,'').trim();
 return text.replace(/^[^\p{L}\p{N}+]+|[^\p{L}\p{N}]+$/gu,'').replace(/\s+/g,' ').trim();
}
function grayAt(data,x,y){const i=(y*data.width+x)*4;return .299*data.data[i]+.587*data.data[i+1]+.114*data.data[i+2]}
function median(values){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]}
function inferMealFromHeading(rawText){
 const heading=String(rawText||'').split(/\r?\n/).map(line=>line.trim()).find(Boolean)||'';
 const fullWord=heading.match(/\b(breakfast|lunch|dinner)\b/i);
 if(fullWord)return {meal:fullWord[1][0].toUpperCase()+fullWord[1].slice(1).toLowerCase(),heading};
 const abbreviation=heading.match(/(?:^|[^\p{L}\p{N}])([bld])(?:$|[^\p{L}\p{N}])/iu);
 if(abbreviation){const meals={b:'Breakfast',l:'Lunch',d:'Dinner'};return {meal:meals[abbreviation[1].toLowerCase()],heading}}
 return {meal:'',heading};
}
function detectVoteRows(imageData){
 const {width:w,height:h}=imageData,x0=Math.floor(w*.46),x1=Math.max(x0+8,Math.floor(w*.72)),means=new Float32Array(h);
 for(let y=0;y<h;y++){let sum=0;for(let x=x0;x<x1;x++)sum+=grayAt(imageData,x,y);means[y]=sum/(x1-x0)}
 const baseline=median(Array.from(means).slice(Math.floor(h*.08),Math.floor(h*.96))),darkBackground=baseline<128,polarity=darkBackground?1:-1,candidates=[];
 for(let y=2;y<h-2;y++)if(y>h*.08&&y<h*.96&&means[y]*polarity>baseline*polarity+8&&means[y]*polarity>=means[y-1]*polarity&&means[y]*polarity>means[y+1]*polarity)candidates.push(y);
 const peaks=[];for(const y of candidates){const last=peaks.at(-1);if(last===undefined||y-last>3)peaks.push(y);else if(means[y]>means[last])peaks[peaks.length-1]=y}
 let best=null;for(let i=0;i<peaks.length;i++)for(let j=i+1;j<peaks.length;j++){
  const step=peaks[j]-peaks[i];if(step<h*.035||step>h*.18)continue;const seq=[peaks[i]],errors=[];let target=peaks[i]+step;
  while(target<h*.97){let nearest=null,distance=Infinity;for(const p of peaks){const d=Math.abs(p-target);if(d<distance){distance=d;nearest=p}}if(nearest===null||distance>Math.max(3,step*.14))break;seq.push(nearest);errors.push(distance/step);target+=step}
  const quality=seq.length-(errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:0);if(!best||quality>best.quality)best={seq,step,quality};
 }
 if(!best||best.seq.length<2)return {rows:[],region:null};
 const boundaries=best.seq,step=median(boundaries.slice(1).map((y,i)=>y-boundaries[i]))||best.step,last=boundaries.at(-1);let end=last+step;
 for(let y=Math.floor(last+step*.5);y<Math.min(h,last+step*1.5);y++)if(darkBackground?means[y]<baseline-8:means[y]>baseline+8){end=y;break}
 end=Math.min(h,end);const rows=[];for(let i=0;i<boundaries.length;i++){const top=boundaries[i],bottom=i+1<boundaries.length?boundaries[i+1]:end;if(bottom-top>=step*.55)rows.push({top,bottom,height:bottom-top})}
 return {rows,region:{x0,y0:boundaries[0],x1,y1:end},dividerYs:boundaries,darkBackground};
}
function findNameBand(imageData,row,x0,x1,darkBackground=true){
 const top=Math.floor(row.top+row.height*.08),bottom=Math.ceil(row.bottom-row.height*.08),minPixels=Math.max(4,Math.round((x1-x0)*.008)),bands=[];
 for(let y=top;y<bottom;y++){let count=0;for(let x=x0;x<x1;x++){const gray=grayAt(imageData,x,y);if(darkBackground?gray>160:gray<110)count++}if(count>=minPixels){const band=bands.at(-1);if(!band||y>band.at(-1)+1)bands.push([y]);else band.push(y)}}
 return bands[0]?{top:Math.max(top,bands[0][0]-5),bottom:Math.min(bottom,bands[0].at(-1)+6)}:{top:Math.floor(row.top+row.height*.25),bottom:Math.floor(row.top+row.height*.7)};
}
function preprocessNameCrop(imageData,box){
 const scale=3,w=box.x1-box.x0,h=box.y1-box.y0,source=document.createElement('canvas');source.width=w;source.height=h;const sx=source.getContext('2d'),patch=sx.createImageData(w,h);
 let background=0,n=0;for(let y=0;y<h;y+=Math.max(1,Math.floor(h/5)))for(let x=0;x<w;x+=Math.max(1,Math.floor(w/12))){background+=grayAt(imageData,box.x0+x,box.y0+y);n++}const invert=background/Math.max(1,n)<128;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const g=grayAt(imageData,box.x0+x,box.y0+y),v=invert?255-g:g,i=(y*w+x)*4;patch.data[i]=patch.data[i+1]=patch.data[i+2]=v;patch.data[i+3]=255}sx.putImageData(patch,0,0);
 const scaled=document.createElement('canvas');scaled.width=w*scale;scaled.height=h*scale;const cx=scaled.getContext('2d');cx.imageSmoothingEnabled=false;cx.drawImage(source,0,0,scaled.width,scaled.height);const out=cx.getImageData(0,0,scaled.width,scaled.height);
 for(let i=0;i<out.data.length;i+=4){const v=out.data[i]<130?0:255;out.data[i]=out.data[i+1]=out.data[i+2]=v}cx.putImageData(out,0,0);return scaled;
}
function renderPollLine(item,line,index){
 const status=line.state==='matched'?`<span class="voter-status matched">Matched</span>`:line.state==='ignored'?`<span class="voter-status ignored">Not a voter</span>`:Number(line.confidence)<55&&!line.reviewed?`<span class="voter-status pending">Needs review</span>`:line.state==='unknown'?`<span class="voter-status unknown">Unknown${line.reviewed?'':' · review'}</span>`:`<span class="voter-status pending">Suggested · review</span>`;
 const label=line.text||`Unrecognized row ${line.rowNumber||index+1}`;
 return `<div class="voter-row ${line.state==='ignored'?'is-ignored':''}" data-line="${line.id}" data-line-state="${line.state}"><span class="voter-serial">${String(index+1).padStart(2,'0')}</span><div class="voter-main"><button type="button" class="voter-name" data-open-voter="${item.id}|${line.id}">${esc(label)}</button>${status}</div><div class="voter-actions"><button type="button" class="voter-icon" aria-label="Edit ${esc(label)}" title="Edit" data-open-voter="${item.id}|${line.id}">✏️</button><button type="button" class="voter-icon" aria-label="Delete ${esc(label)}" title="Delete" data-delete-voter="${item.id}|${line.id}">🗑️</button></div></div>`;
}
function findBatchLine(key){const [pollId,lineId]=key.split('|');const item=batchItems.find(x=>x.id===pollId);return {item,line:item?.lines.find(x=>x.id===lineId)}}
function openVoterDialog(pollId,lineId=''){
 const item=batchItems.find(x=>x.id===pollId);if(!item)return;
 const line=lineId?item.lines.find(x=>x.id===lineId):null;if(lineId&&!line)return;
 reviewingPollId=pollId;reviewingLineId=lineId||null;
 $('#voterForm').reset();$('#voterFormError').textContent='';$('#voterDialogTitle').textContent=line?'Review extracted voter':'Add missing voter';
 $('#voterName').value=line?.text||'';
 $('#voterResident').innerHTML=`<option value="">Choose a resident</option>${active().map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}`;
 $('#voterResident').value=line?.residentId||'';$('#voterStatus').value=line?.state||'pending';
 renderVoterSuggestions($('#voterName').value);$('#voterDialog').showModal();$('#voterName').focus();
}
function renderVoterSuggestions(text){const suggestions=matchSuggestions(text);$('#voterSuggestions').innerHTML=suggestions.length?`<small>Suggestions:</small>${suggestions.map(r=>`<button type="button" class="suggestion-chip" data-dialog-suggest="${r.id}">${esc(r.name)}</button>`).join('')}`:'';$('#voterSuggestions').querySelectorAll('[data-dialog-suggest]').forEach(b=>b.onclick=()=>{$('#voterResident').value=b.dataset.dialogSuggest;$('#voterStatus').value='matched'})}
function bindVoterDialog(){
 $('#cancelVoter').onclick=()=>$('#voterDialog').close();$('#voterName').oninput=e=>renderVoterSuggestions(e.target.value);
 $('#voterForm').onsubmit=e=>{e.preventDefault();const item=batchItems.find(x=>x.id===reviewingPollId),text=$('#voterName').value.trim(),residentId=$('#voterResident').value,status=$('#voterStatus').value,error=$('#voterFormError');error.textContent='';if(!item||!text){error.textContent='Enter the extracted voter name.';return}if(status==='matched'&&!residentId){error.textContent='Choose the resident to confirm this match.';return}
  let line=reviewingLineId?item.lines.find(x=>x.id===reviewingLineId):null;const suggestions=matchSuggestions(text);if(!line){line={id:uid(),text,suggestions,residentId:'',state:'pending',reviewed:false};item.lines.push(line)}
  line.text=text;line.suggestions=suggestions;line.residentId=status==='matched'?residentId:(status==='pending'&&residentId?residentId:'');line.state=status;line.reviewed=status!=='pending';$('#voterDialog').close();renderBatchArea();
 };
 $('#addVoterAsResident').onclick=()=>{const text=$('#voterName').value.trim(),error=$('#voterFormError');error.textContent='';if(!text){error.textContent='Enter a name first.';return}const existing=store.residents.find(r=>r.active!==false&&normalizeName(r.name)===normalizeName(text));if(existing){$('#voterResident').value=existing.id;toast('That resident is already registered');return}const resident={id:uid(),name:text,active:true,createdAt:new Date().toISOString()};store.residents.push(resident);save();$('#voterResident').innerHTML=`<option value="">Choose a resident</option>${active().map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}`;$('#voterResident').value=resident.id;$('#voterStatus').value='pending';renderVoterSuggestions(text);toast('Resident added; confirm the match before applying')};
}
function bindBatchReview(){
 const root=$('#batchDialog');
 root.querySelectorAll('[data-poll-date]').forEach(x=>x.onchange=()=>{const i=batchItems.find(y=>y.id===x.dataset.pollDate);if(i){i.date=x.value;renderBatchArea()}});
 root.querySelectorAll('[data-source-poll]').forEach(b=>b.onclick=()=>{activePollId=b.dataset.sourcePoll;renderBatchArea()});
 root.querySelectorAll('[data-poll-meal]').forEach(x=>x.onchange=()=>{const i=batchItems.find(y=>y.id===x.dataset.pollMeal);if(i){i.meal=x.value;renderBatchArea()}});
 root.querySelectorAll('[data-remove-poll]').forEach(b=>b.onclick=()=>{const removed=batchItems.find(x=>x.id===b.dataset.removePoll);batchItems=batchItems.filter(x=>x.id!==b.dataset.removePoll);if(activePollId===b.dataset.removePoll)activePollId=batchItems[0]?.id||null;URL.revokeObjectURL(removed?.previewUrl);renderBatchArea()});
 root.querySelectorAll('[data-voter-tab]').forEach(b=>b.onclick=()=>{const [pollId,tab]=b.dataset.voterTab.split('|'),item=batchItems.find(x=>x.id===pollId);if(item){item.activeTab=tab;renderBatchArea()}});
 root.querySelectorAll('[data-open-voter]').forEach(b=>b.onclick=()=>{const [pollId,lineId]=b.dataset.openVoter.split('|');openVoterDialog(pollId,lineId)});
 root.querySelectorAll('[data-add-missing]').forEach(b=>b.onclick=()=>openVoterDialog(b.dataset.addMissing));
 root.querySelectorAll('[data-delete-voter]').forEach(b=>b.onclick=()=>{const [pollId,lineId]=b.dataset.deleteVoter.split('|'),item=batchItems.find(x=>x.id===pollId);if(!item)return;const idx=item.lines.findIndex(x=>x.id===lineId);if(idx<0)return;const line=item.lines[idx];if(!window.confirm(`Remove “${line.text}” from this OCR review?`))return;item.deletedLines||=[];item.deletedLines.push({...line,deleted:true});item.lines.splice(idx,1);renderBatchArea()});
 root.querySelectorAll('[data-replace]').forEach(x=>x.onchange=()=>{const i=batchItems.find(y=>y.id===x.dataset.replace);if(i)i.replaceExisting=x.checked;updateApplyButton()});
 $('#applyBatch').onclick=applyBatch;
 updateApplyButton();
}
function updateApplyButton(){const btn=$('#applyBatch');if(!btn)return;const keys=batchItems.map(i=>mealKey(i.date,i.meal)),duplicateBatch=new Set(keys).size!==keys.length;btn.disabled=duplicateBatch||batchItems.some(i=>!i.date||!i.meal||i.status!=='read'||!(i.lines.length||i.deletedLines?.length)||i.lines.some(l=>!l.reviewed||!['matched','unknown','ignored'].includes(l.state))||(store.meals[mealKey(i.date,i.meal)]&&!i.replaceExisting));}
function renderBatchArea(){const area=$('#batchReview');if(area){area.innerHTML=renderBatchMarkup();bindBatchReview();$('#processPolls').disabled=!batchItems.length;$('#clearPolls').disabled=!batchItems.length;const message=batchItems.length?`${batchItems.length} screenshot${batchItems.length===1?'':'s'} in this review batch.`:'';$('#batchStatus').textContent=message;$('#batchModalStatus').textContent=message;updateApplyButton();if(batchItems.length&&!$('#batchDialog').open)$('#batchDialog').showModal();if(!batchItems.length&&$('#batchDialog').open)$('#batchDialog').close()}}
async function ensureOcr(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('vendor/tesseract/tesseract.min.js',document.baseURI).href;s.onload=()=>window.Tesseract?resolve():reject(new Error('Tesseract script loaded without an OCR engine'));s.onerror=()=>reject(new Error(`Could not load local OCR script: ${s.src}`));document.head.append(s)})}
async function loadPollImage(file){
 const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);bitmap.close?.();return {canvas,imageData};
}
async function processBatch(){
 if(!batchItems.length)return;$('#batchStatus').textContent='Loading OCR engine…';$('#processPolls').disabled=true;
 let worker,ocrStage='loading the OCR engine';
 try{if(!$('#batchDialog').open)$('#batchDialog').showModal();await ensureOcr();const ocrBase=new URL('vendor/tesseract/',document.baseURI).href.replace(/\/$/,'');ocrStage='starting the OCR worker';worker=await Tesseract.createWorker('eng',1,{workerPath:`${ocrBase}/worker.min.js`,corePath:`${ocrBase}/core`,langPath:`${ocrBase}/lang`,gzip:false,workerBlobURL:false,logger:m=>{if(m.status==='recognizing text'){const status=`Reading ${m.progress?Math.round(m.progress*100):0}%`;$('#batchStatus').textContent=status;$('#batchModalStatus').textContent=status}}});
  for(const item of batchItems){if(item.status==='read')continue;item.status='reading';renderBatchArea();
   ocrStage=`reading ${item.fileName}`;await worker.setParameters({tessedit_pageseg_mode:'3'});const full=await worker.recognize(item.file);item.fullCropRawText=full.data.text||'';
   const {canvas,imageData}=await loadPollImage(item.file),detected=detectVoteRows(imageData),x1=Math.min(canvas.width,Math.floor(canvas.width*.74));item.voterRegion=detected.region;item.debugCrops=[];item.lines=[];
   const inferredMeal=inferMealFromHeading(item.fullCropRawText);item.mealHeading=inferredMeal.heading;
   if(inferredMeal.meal)item.meal=inferredMeal.meal;
   else console.warn('[Pink Plate OCR] Could not infer meal from poll heading; tested heading:',inferredMeal.heading);
   let rowSpecs=detected.rows;
   if(!rowSpecs.length){const fallback=(full.data.text||'').split(/\r?\n/).map(text=>text.trim()).filter(Boolean);rowSpecs=fallback.map((text,i)=>({top:Math.floor(canvas.height*i/fallback.length),bottom:Math.floor(canvas.height*(i+1)/fallback.length),height:Math.max(1,Math.floor(canvas.height/fallback.length)),fallbackText:text}))}
   await worker.setParameters({tessedit_pageseg_mode:'7'});
   for(let index=0;index<rowSpecs.length;index++){
    const row=rowSpecs[index],leftPadding=Math.max(8,Math.round(row.height*.1)),x0=Math.max(0,Math.floor(canvas.width*.1)-leftPadding);let rawText='',confidence=0,cropUrl='';
    if(row.fallbackText){rawText=row.fallbackText;confidence=0}
    else{const verticalInset=Math.round(row.height*.12),box={x0,y0:Math.floor(row.top+verticalInset),x1,y1:Math.ceil(row.bottom-verticalInset)},crop=preprocessNameCrop(imageData,box),result=await worker.recognize(crop);rawText=String(result.data.text||'').trim();confidence=Number(result.data.confidence)||0;try{cropUrl=crop.toDataURL('image/jpeg',.78)}catch{}}
    const text=cleanVoterName(rawText),suggestions=matchSuggestions(text),resident=confidentResidentMatch(text,confidence);item.debugCrops.push(cropUrl);item.lines.push({id:uid(),text,rawText,confidence:Math.round(confidence),suggestions,residentId:resident?.id||'',state:resident?'matched':suggestions.length?'pending':'unknown',reviewed:!!resident,rowNumber:index+1,bbox:{x0,y0:row.top,x1,y1:row.bottom}});
   }
   item.rawText=`${item.lines.map((line,i)=>`Row ${String(i+1).padStart(2,'0')} · confidence ${line.confidence}: ${line.rawText||'[no text recognized]'}`).join('\n')}\n\nFULL IMAGE OCR\n${item.fullCropRawText}`;
   item.status='read';item.activeTab=item.lines.some(line=>!line.reviewed)?'unknown':'extracted';renderBatchArea();
  }
  $('#batchStatus').textContent='OCR complete. Review only new or uncertain names before applying.';$('#batchModalStatus').textContent='Clear resident matches are ready. Review only new or uncertain names before applying.'}
 catch(e){console.error(`[Pink Plate OCR] Failed while ${ocrStage}:`,e);const message=`OCR failed while ${ocrStage}: ${e?.message||String(e)}. You can retry; no meal records were changed.`;$('#batchStatus').textContent=message;$('#batchModalStatus').textContent=message;batchItems.forEach(i=>{if(i.status==='reading')i.status='ready'})}
 finally{if(worker)await worker.terminate();$('#processPolls').disabled=!batchItems.length;updateApplyButton()}
}
function applyBatch(){
 if($('#applyBatch')?.disabled)return;
 for(const item of batchItems){const attendees={};for(const line of item.lines)if(line.state==='matched')attendees[line.residentId]=(attendees[line.residentId]||0)+1;
  const previous=store.meals[mealKey(item.date,item.meal)]||{};
  store.meals[mealKey(item.date,item.meal)]={...previous,attendees:Object.entries(attendees).map(([id,units])=>({id,units})),unknownVoters:item.lines.filter(l=>l.state==='unknown').map(l=>({text:l.text,rawText:l.rawText,confidence:l.confidence,source:item.fileName})),ignoredOcrLines:[...item.lines.filter(l=>l.state==='ignored').map(l=>({text:l.text,rawText:l.rawText,confidence:l.confidence,source:item.fileName})),...(item.deletedLines||[]).map(l=>({text:l.text,rawText:l.rawText,confidence:l.confidence,source:item.fileName,deleted:true}))],sourceScreenshots:[...(previous.sourceScreenshots||[]),item.fileName],ocrText:[previous.ocrText,item.rawText].filter(Boolean).join('\n---\n'),updatedAt:new Date().toISOString()};
 }
 save();batchItems.forEach(item=>URL.revokeObjectURL(item.previewUrl));batchItems=[];activePollId=null;$('#batchDialog').close();renderAll();toast('Reviewed polls applied');
}
function renderMonthly(){
 const days=dayKeys(),residents=peopleForHistory(),monthlyTotal=monthMeals();
 const dayTotals=days.map(d=>dailyTotal(d));
 $('#page-monthly').innerHTML=`${header('MEAL HISTORY','Monthly overview',`Residents are listed down the left, with each date across the top. Select any cell to correct that day's breakfast, lunch or dinner.` ,`<button class="btn btn-secondary no-print" id="exportMonthly">↓ Download CSV</button>`)}
 <div class="stats"><div class="stat"><div class="stat-label">MONTH TOTAL</div><div class="stat-value">${monthlyTotal.toLocaleString(undefined,{maximumFractionDigits:1})}</div><div class="stat-note">Meal units in ${monthLabel()}</div></div><div class="stat"><div class="stat-label">DAILY AVERAGE</div><div class="stat-value">${(monthlyTotal/days.length).toLocaleString(undefined,{maximumFractionDigits:1})}</div><div class="stat-note">Meal units per calendar day</div></div><div class="stat"><div class="stat-label">RESIDENTS</div><div class="stat-value">${residents.length}</div><div class="stat-note">Active and with meal history</div></div></div>
 <div class="card"><div class="card-head"><div><h2>${monthLabel()} · meal units by resident</h2><p>Click a day's count to open its individual meal entries and make corrections.</p></div><span class="pill">${days.length} DAYS</span></div><div class="matrix-scroll"><table class="matrix"><thead><tr><th class="sticky-col">Resident</th>${days.map(d=>`<th><span>${Number(d.slice(-2))}</span><small>${dateLabel(d,{weekday:'short'})}</small></th>`).join('')}<th class="total-col">MONTH</th></tr></thead><tbody>${residents.length?residents.map(r=>`<tr><th class="sticky-col resident-cell">${esc(r.name)}${r.active===false?'<small>REMOVED</small>':''}</th>${days.map(d=>`<td><button type="button" class="matrix-value ${residentDaily(r.id,d)?'has-units':''}" data-matrix-cell="${d}|${r.id}" title="Edit ${esc(r.name)} on ${dateLabel(d)}">${residentDaily(r.id,d).toLocaleString(undefined,{maximumFractionDigits:1})}</button></td>`).join('')}<td class="total-col amount">${residentMonth(r.id).toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr>`).join(''):`<tr><td colspan="${days.length+2}">${empty('No residents yet','Add residents to build your monthly meal overview.')}</td></tr>`}</tbody><tfoot><tr><th class="sticky-col">DAILY TOTAL</th>${dayTotals.map((n,i)=>`<td><button class="matrix-value daily-total" data-open-date="${days[i]}">${n.toLocaleString(undefined,{maximumFractionDigits:1})}</button></td>`).join('')}<td class="total-col amount">${monthlyTotal.toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr></tfoot></table></div><div class="card-body detail-line">Monthly rate: <strong>${cash(rate())}</strong> per meal unit · Total expenses: <strong>${cash(expensesTotal())}</strong></div></div>`;
 $('#page-monthly').querySelectorAll('[data-matrix-cell],[data-open-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.openDate||b.dataset.matrixCell.split('|')[0];setPage('daily')});
 $('#exportMonthly').onclick=exportMonthlyCsv;
}
function renderFinance(){
 const payments=monthPayments().slice().sort((a,b)=>b.date.localeCompare(a.date)),expenses=monthExpenses().slice().sort((a,b)=>b.date.localeCompare(a.date)),mealRate=rate();
 const residents=peopleForHistory();
 $('#page-finance').innerHTML=`${header('MESS ACCOUNTS','Payments & expenses',`Financial records stay separate from meal entries. Month-end resident balances use meals × the monthly rate.`,`<div class="toolbar no-print"><button class="btn btn-secondary" id="backupData">↓ Backup JSON</button><button class="btn btn-primary" id="printReport">Print / save PDF</button></div>`)}
 <div class="report-head"><h1>Pink Plate · Monthly resident accounts</h1><p>${monthLabel()}</p></div>
 <div class="bill-summary"><div class="stat"><div class="stat-label">TOTAL COLLECTIONS</div><div class="stat-value">${cash(collections())}</div><div class="stat-note">${payments.length} payment entries</div></div><div class="stat"><div class="stat-label">TOTAL EXPENSES</div><div class="stat-value">${cash(expensesTotal())}</div><div class="stat-note">${expenses.length} expense entries</div></div><div class="stat"><div class="stat-label">TOTAL MEALS</div><div class="stat-value">${monthMeals().toLocaleString(undefined,{maximumFractionDigits:1})}</div><div class="stat-note">Confirmed meal units</div></div><div class="stat"><div class="stat-label">RATE PER MEAL</div><div class="stat-value">${cash(mealRate)}</div><div class="stat-note">Expenses ÷ meals</div></div></div>
 <div class="finance-forms no-print"><div class="card"><div class="card-head"><div><h2>Record a payment</h2><p>Attach a payment to a resident and date.</p></div></div><form id="paymentForm" class="card-body form-stack"><div class="field"><label>RESIDENT</label><select name="residentId" required>${active().map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label>DATE</label><input type="date" name="date" value="${selectedDate}" required></div><div class="field"><label>AMOUNT (₹)</label><input type="number" name="amount" min="0.01" step="0.01" required></div></div><div class="field"><label>NOTE (OPTIONAL)</label><input name="description" maxlength="120" placeholder="e.g. November advance"></div><button class="btn btn-primary" type="submit">Save payment</button></form></div>
 <div class="card"><div class="card-head"><div><h2>Record an expense</h2><p>Add the mess expense date, description and amount.</p></div></div><form id="expenseForm" class="card-body form-stack"><div class="field"><label>DESCRIPTION</label><input name="description" maxlength="120" placeholder="e.g. Vegetables, groceries" required></div><div class="form-grid"><div class="field"><label>DATE</label><input type="date" name="date" value="${selectedDate}" required></div><div class="field"><label>AMOUNT (₹)</label><input type="number" name="amount" min="0.01" step="0.01" required></div></div><button class="btn btn-primary" type="submit">Save expense</button></form></div></div>
 <div class="card"><div class="card-head"><div><h2>Resident balances</h2><p>Charge = resident meal units × monthly meal rate. Positive due means the resident owes.</p></div></div><div class="table-wrap">${residents.length?`<table><thead><tr><th>Resident</th><th>Meals</th><th>Rate</th><th>Charge</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${residents.map(r=>{const meals=residentMonth(r.id),charge=meals*mealRate,paid=payments.filter(p=>p.residentId===r.id).reduce((n,p)=>n+Number(p.amount||0),0),balance=charge-paid;return `<tr><td class="table-name">${esc(r.name)}</td><td>${meals.toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>${cash(mealRate)}</td><td class="amount">${cash(charge)}</td><td>${cash(paid)}</td><td class="amount ${balance>0?'danger':balance<0?'credit':''}">${balance>0?`OWES ${cash(balance)}`:balance<0?`CREDIT ${cash(-balance)}`:'SETTLED'}</td></tr>`}).join('')}</tbody></table>`:empty('No residents','Register residents to view balances.')}</div></div>
 <div class="finance-ledgers"><div class="card"><div class="card-head"><div><h2>Payments</h2><p>${monthLabel()}</p></div><span class="pill">${payments.length}</span></div><div class="table-wrap">${payments.length?`<table><thead><tr><th>Date</th><th>Resident</th><th>Amount</th><th>Note</th><th class="no-print">Action</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${dateLabel(p.date)}</td><td>${esc(store.residents.find(r=>r.id===p.residentId)?.name||'Removed resident')}</td><td class="amount">${cash(p.amount)}</td><td>${esc(p.description||'—')}</td><td class="no-print"><button class="text-button danger" data-void-payment="${p.id}">Remove</button></td></tr>`).join('')}</tbody></table>`:empty('No payments recorded','Add each payment above.')}</div></div>
 <div class="card"><div class="card-head"><div><h2>Expenses</h2><p>${monthLabel()}</p></div><span class="pill">${expenses.length}</span></div><div class="table-wrap">${expenses.length?`<table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th class="no-print">Action</th></tr></thead><tbody>${expenses.map(e=>`<tr><td>${dateLabel(e.date)}</td><td>${esc(e.description)}</td><td class="amount">${cash(e.amount)}</td><td class="no-print"><button class="text-button danger" data-void-expense="${e.id}">Remove</button></td></tr>`).join('')}</tbody></table>`:empty('No expenses recorded','Add all monthly mess expenses above.')}</div></div></div>
 <div class="callout">Outstanding balance is shown as <strong>OWES</strong>; payments above the calculated charge are shown as a <strong>CREDIT</strong>. Removing a financial row excludes it from totals while retaining the row in local data.</div>`;
 $('#paymentForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);store.payments.push({id:uid(),residentId:f.get('residentId'),date:f.get('date'),amount:Number(f.get('amount')),description:String(f.get('description')||'').trim(),createdAt:new Date().toISOString()});save();renderAll()};
 $('#expenseForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);store.expenses.push({id:uid(),description:String(f.get('description')).trim(),date:f.get('date'),amount:Number(f.get('amount')),createdAt:new Date().toISOString()});save();renderAll()};
 $('#page-finance').querySelectorAll('[data-void-payment]').forEach(b=>b.onclick=()=>{const p=store.payments.find(x=>x.id===b.dataset.voidPayment);if(p){p.voided=true;save();renderAll()}});
 $('#page-finance').querySelectorAll('[data-void-expense]').forEach(b=>b.onclick=()=>{const x=store.expenses.find(e=>e.id===b.dataset.voidExpense);if(x){x.voided=true;save();renderAll()}});
 $('#backupData').onclick=exportBackup;$('#printReport').onclick=()=>window.print();
}
function exportBackup(){const blob=new Blob([JSON.stringify({format:'pink-plate-backup-v2',exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pink-plate-backup-${selectedMonth}.json`;a.click();URL.revokeObjectURL(url)}
function exportMonthlyCsv(){
 const days=dayKeys(),rows=[['Resident',...days.map(d=>dateLabel(d,{day:'numeric'})),'Monthly total']];
 for(const r of peopleForHistory())rows.push([r.name,...days.map(d=>residentDaily(r.id,d)),residentMonth(r.id)]);
 rows.push(['Daily total',...days.map(d=>dailyTotal(d)),monthMeals()]);
 const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=`meal-overview-${selectedMonth}.csv`;a.click();URL.revokeObjectURL(url);
}
function renderAll(){
 $('#monthSelect').value=selectedMonth;
 renderDashboard();renderResidents();renderDaily();renderMonthly();renderFinance();
 document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${currentPage}`));
}
document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$('#monthSelect').onchange=e=>{selectedMonth=e.target.value||asMonth(new Date());selectedDate=`${selectedMonth}-01`;renderAll()};
document.querySelector('[data-close-batch]').onclick=()=>$('#batchDialog').close();
bindResidentDialog();bindVoterDialog();renderAll();
