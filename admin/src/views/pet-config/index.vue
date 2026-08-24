<template>
  <div class="page-container">
    <div class="card">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <!-- 时段配置 -->
        <el-tab-pane label="时段配置" name="schedules">
          <div class="search-bar" style="justify-content:flex-end;">
            <el-button type="primary" @click="saveSchedules" v-perm="'pet_config:write'">保存</el-button>
          </div>
          <el-form label-width="140px" class="schedule-form">
            <el-divider content-position="left">作息</el-divider>
            <el-form-item label="睡觉时间">
              <el-time-select v-model="global.sleep_start" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <span style="margin:0 8px;">至次日</span>
              <el-time-select v-model="global.sleep_end" start="00:00" step="00:30" end="23:59" style="width:140px;" />
            </el-form-item>

            <el-divider content-position="left">三餐时间</el-divider>
            <div v-for="(meal, idx) in schedules.meals" :key="meal.key" class="meal-row">
              <el-input v-model="meal.name" placeholder="餐名" style="width:120px;" />
              <el-time-select v-model="meal.start" placeholder="开始" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <span style="margin:0 8px;">至</span>
              <el-time-select v-model="meal.end" placeholder="结束" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <el-button link type="danger" @click="removeMeal(idx)" v-perm="'pet_config:write'">删除</el-button>
            </div>
            <el-button size="small" @click="addMeal" v-perm="'pet_config:write'">+ 添加餐次</el-button>

            <el-divider content-position="left">运动时间（可配置多个时段）</el-divider>
            <div v-for="(win, idx) in schedules.exerciseWindows" :key="idx" class="meal-row">
              <el-time-select v-model="win.start" placeholder="开始" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <span style="margin:0 8px;">至</span>
              <el-time-select v-model="win.end" placeholder="结束" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <el-button link type="danger" @click="schedules.exerciseWindows.splice(idx, 1)" v-perm="'pet_config:write'">删除</el-button>
            </div>
            <el-button size="small" @click="schedules.exerciseWindows.push({ key: `ex_${Date.now()}`, start: '19:30', end: '21:00' })" v-perm="'pet_config:write'">+ 添加运动时段</el-button>

            <el-divider content-position="left">逛逛时间</el-divider>
            <div v-for="(win, idx) in schedules.explore.windows" :key="win.key" class="meal-row">
              <el-input v-model="win.key" placeholder="标识" style="width:100px;" />
              <el-time-select v-model="win.start" placeholder="开始" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <span style="margin:0 8px;">至</span>
              <el-time-select v-model="win.end" placeholder="结束" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <el-input-number v-model="win.probability" :min="0" :max="1" :precision="2" :step="0.05" placeholder="概率" style="width:120px;" />
              <el-button link type="danger" @click="removeExploreWindow(idx)" v-perm="'pet_config:write'">删除</el-button>
            </div>
            <el-button size="small" @click="addExploreWindow" v-perm="'pet_config:write'">+ 添加逛逛窗口</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 运动库（独立模块：非器械/器械运动，器械来源于商城器材） -->
        <el-tab-pane label="运动库" name="exercises">
          <div class="search-bar">
            <el-input v-model="exerciseQuery.keyword" placeholder="运动名称" clearable style="width:220px;" />
            <el-button type="primary" @click="loadExercises">查询</el-button>
            <el-button type="success" @click="openExerciseDialog()" v-perm="'pet_config:write'">新增</el-button>
          </div>
          <el-table :data="exerciseList" v-loading="exerciseLoading" border empty-text="暂无内容" row-key="id">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="exercise_key" label="标识" width="120" />
            <el-table-column prop="name" label="名称" />
            <el-table-column label="器械" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.use_equipment" type="warning">{{ row.equipment_name || `器材#${row.equipment_item_id}` }}</el-tag>
                <span v-else>非器械</span>
              </template>
            </el-table-column>
            <el-table-column label="运动动画" width="110">
              <template #default="{ row }">
                <el-image v-if="row.anim_url" :src="row.anim_url" fit="contain" style="width:48px;height:48px;" />
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="跟练课程" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.has_workout" type="success">{{ row.workout_name || row.workout_key }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="70" />
            <el-table-column prop="is_enabled" label="启用" width="80">
              <template #default="{ row }"><el-tag :type="!!row.is_enabled ? 'success' : 'info'">{{ !!row.is_enabled ? '是' : '否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button link type="primary" @click="openExerciseDialog(row)" v-perm="'pet_config:write'">编辑</el-button>
                <el-button link type="danger" @click="removeExercise(row)" v-perm="'pet_config:write'">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-model:current-page="exerciseQuery.page" v-model:page-size="exerciseQuery.size" :total="exerciseTotal" layout="total, prev, pager, next" class="pagination" @change="loadExercises" />
        </el-tab-pane>

        <!-- 课程库（陪你动跟练课程，运动库的跟练选项来源于此） -->
        <el-tab-pane label="课程库" name="workouts">
          <WorkoutConfig />
        </el-tab-pane>

        <!-- 限制配置 -->
        <el-tab-pane label="限制配置" name="limits">
          <div class="search-bar" style="justify-content:flex-end;">
            <el-button type="primary" @click="saveLimits" v-perm="'pet_config:write'">保存</el-button>
          </div>
          <el-form label-width="180px">
            <el-form-item label="每日外出上限">
              <el-input-number v-model="global.explore.daily_max_count" :min="1" :max="20" />
            </el-form-item>
            <el-form-item label="每日事件上限">
              <el-input-number v-model="schedules.explore.daily_event_max" :min="1" :max="20" />
            </el-form-item>
            <el-form-item label="居家事件触发概率">
              <el-input-number v-model="schedules.explore.home_event_chance_pct" :min="0" :max="100" />
              <span style="margin-left:12px;color:#909399;font-size:12px;">居家时段每次进入搭搭页触发事件掉落的概率（%），每天最多触发 1 次；外出事件为外出归来时按概率权重必掉</span>
            </el-form-item>
            <el-form-item label="每次喂食最多食物种类">
              <el-input-number v-model="schedules.feed.max_items_per_feed" :min="1" :max="10" />
            </el-form-item>
            <el-form-item label="每日喂食次数上限">
              <el-input-number v-model="schedules.feed.max_feeds_per_day" :min="1" :max="20" />
            </el-form-item>
            <el-form-item label="每日运动次数上限">
              <el-input-number v-model="schedules.exerciseLimits.max_per_day" :min="1" :max="10" />
            </el-form-item>
            <el-form-item label="每日日记分析消耗">
              <span style="margin-right:8px;">浆果</span>
              <el-input-number v-model="analysisCost.berries" :min="0" style="width:120px;" />
              <span style="margin:0 8px;">鲜花</span>
              <el-input-number v-model="analysisCost.flowers" :min="0" style="width:120px;" />
              <div style="color:#909399;font-size:12px;line-height:1.6;width:100%;">生成每日分析/月度总结时扣除，余额不足则不可生成</div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 形象配置 -->
        <el-tab-pane label="形象配置" name="sprite">
          <div class="search-bar" style="justify-content:flex-end;">
            <el-button type="primary" @click="saveSprite" v-perm="'pet_config:write'">保存</el-button>
          </div>
          <el-form label-width="180px" class="schedule-form">
            <el-divider content-position="left">展示位置（地图坐标：以背景图左上角为原点，参考高度见场景配置）</el-divider>
            <el-form-item label="X 坐标（left）">
              <el-input-number v-model="sprite.x" :min="0" :max="2000" />
            </el-form-item>
            <el-form-item label="Y 坐标（top）">
              <el-input-number v-model="sprite.y" :min="0" :max="2000" />
            </el-form-item>
            <el-form-item label="宽度">
              <el-input-number v-model="sprite.width" :min="10" :max="750" />
            </el-form-item>
            <el-form-item label="高度">
              <el-input-number v-model="sprite.height" :min="10" :max="1000" />
            </el-form-item>
            <el-divider content-position="left">序列帧（按顺序播放，配置 1 张则为静态形象）</el-divider>
            <el-form-item label="播放速率（每秒张数）">
              <el-input-number v-model="sprite.fps" :min="1" :max="24" />
            </el-form-item>
            <div v-for="(frame, idx) in sprite.frames" :key="idx" class="frame-row">
              <span class="frame-index">{{ idx + 1 }}</span>
              <ImageUpload v-model="sprite.frames[idx]" width="64px" height="64px" />
              <el-button link type="primary" :disabled="idx === 0" @click="moveFrame(idx, -1)" v-perm="'pet_config:write'">上移</el-button>
              <el-button link type="primary" :disabled="idx === sprite.frames.length - 1" @click="moveFrame(idx, 1)" v-perm="'pet_config:write'">下移</el-button>
              <el-button link type="danger" @click="sprite.frames.splice(idx, 1)" v-perm="'pet_config:write'">删除</el-button>
            </div>
            <el-button size="small" @click="sprite.frames.push('')" v-perm="'pet_config:write'">+ 添加帧</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 场景配置 -->
        <el-tab-pane label="场景配置" name="scenes">
          <div class="search-bar" style="justify-content:flex-end;">
            <el-button type="primary" @click="saveScenes" v-perm="'pet_config:write'">保存</el-button>
          </div>
          <el-form label-width="140px" class="schedule-form">
            <el-form-item label="默认场景">
              <el-select v-model="scenesConfig.default" style="width:200px;">
                <el-option v-for="s in scenesConfig.list" :key="s.key" :label="s.name" :value="s.key" />
              </el-select>
              <span style="margin-left:12px;color:#909399;font-size:12px;">配置多个场景时 App 才会显示场景切换入口</span>
            </el-form-item>
            <el-divider content-position="left">场景列表</el-divider>
            <div v-for="(scene, idx) in scenesConfig.list" :key="idx" class="scene-card">
              <div class="scene-card-header">
                <el-input v-model="scene.key" placeholder="标识，如 room" style="width:140px;" />
                <el-input v-model="scene.name" placeholder="场景名称，如 小窝" style="width:160px;" />
                <el-input-number v-model="scene.bg_height" :min="500" :max="3000" :precision="0" style="width:130px;" />
                <span style="color:#909399;font-size:12px;">背景参考高度</span>
                <el-input-number v-model="scene.bg_aspect" :min="0.1" :max="5" :precision="4" :step="0.01" style="width:130px;" />
                <span style="color:#909399;font-size:12px;">背景宽高比</span>
                <el-button link type="danger" @click="scenesConfig.list.splice(idx, 1)" v-perm="'pet_config:write'">删除场景</el-button>
              </div>
              <div style="color:#909399;font-size:12px;margin:4px 0 8px;">
                地图坐标系：以背景图左上角为原点，Y 轴范围 0 ~ 背景参考高度，X 轴范围 0 ~ 参考高度 × 宽高比。形象配置与状态库中的坐标/尺寸均基于此坐标系，App 端按屏幕等比缩放、不随屏幕尺寸漂移。
              </div>
              <div class="scene-bg-row">
                <div class="scene-bg-item">
                  <ImageUpload v-model="scene.bg_day" width="100%" height="90px" tip="白天（6:01-19:00）" />
                </div>
                <div class="scene-bg-item">
                  <ImageUpload v-model="scene.bg_evening" width="100%" height="90px" tip="傍晚（19:01-22:00）" />
                </div>
                <div class="scene-bg-item">
                  <ImageUpload v-model="scene.bg_night" width="100%" height="90px" tip="夜晚（22:01-6:00）" />
                </div>
              </div>
            </div>
            <el-button size="small" @click="addScene" v-perm="'pet_config:write'">+ 添加场景</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 状态库 -->
        <el-tab-pane label="状态库" name="states">
          <div class="search-bar">
            <el-input v-model="stateQuery.keyword" placeholder="状态名称" clearable style="width:220px;" />
            <el-button type="primary" @click="loadStates">查询</el-button>
            <el-button type="success" @click="openStateDialog()" v-perm="'pet_config:write'">新增</el-button>
          </div>
          <el-table :data="states" v-loading="stateLoading" border empty-text="暂无内容" row-key="id">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="state_key" label="标识" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="scene_key" label="场景" width="100" />
            <el-table-column label="持续时长" width="100">
              <template #default="{ row }">{{ row.duration_minutes ?? 30 }} 分钟</template>
            </el-table-column>
            <el-table-column label="序列帧" width="90">
              <template #default="{ row }">{{ Array.isArray(row.frames_json) ? row.frames_json.length : 0 }}</template>
            </el-table-column>
            <el-table-column label="坐标" width="120">
              <template #default="{ row }">{{ row.pos_x ?? '-' }}, {{ row.pos_y ?? '-' }}</template>
            </el-table-column>
            <el-table-column prop="time_ranges" label="时段">
              <template #default="{ row }">{{ formatTimeRanges(row.time_ranges) }}</template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="80" />
            <el-table-column prop="is_enabled" label="启用" width="80">
              <template #default="{ row }">
                <el-tag :type="!!row.is_enabled ? 'success' : 'info'">{{ !!row.is_enabled ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button link type="primary" @click="openStateDialog(row)" v-perm="'pet_config:write'">编辑</el-button>
                <el-button link type="danger" @click="removeState(row)" v-perm="'pet_config:write'">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-model:current-page="stateQuery.page" v-model:page-size="stateQuery.size" :total="stateTotal" layout="total, prev, pager, next" class="pagination" @change="loadStates" />
        </el-tab-pane>

        <!-- 对话库 -->
        <el-tab-pane label="对话库" name="dialogues">
          <div class="search-bar">
            <el-input v-model="dialogueQuery.keyword" placeholder="对话文本" clearable style="width:220px;" />
            <el-button type="primary" @click="loadDialogues">查询</el-button>
            <el-button type="success" @click="openDialogueDialog()" v-perm="'pet_config:write'">新增</el-button>
          </div>
          <el-table :data="dialogues" v-loading="dialogueLoading" border empty-text="暂无内容">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="scene" label="场景" width="140" />
            <el-table-column label="用途" width="160">
              <template #default="{ row }">
                <el-tag size="small" :type="dialogueUsageType(row.scene)">{{ dialogueUsageLabel(row.scene) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="text" label="文本" show-overflow-tooltip />
            <el-table-column prop="weight" label="权重" width="80" />
            <el-table-column prop="probability" label="概率" width="80" />
            <el-table-column prop="is_enabled" label="启用" width="80">
              <template #default="{ row }"><el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDialogueDialog(row)" v-perm="'pet_config:write'">编辑</el-button>
                <el-button link type="danger" @click="removeDialogue(row)" v-perm="'pet_config:write'">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-model:current-page="dialogueQuery.page" v-model:page-size="dialogueQuery.size" :total="dialogueTotal" layout="total, prev, pager, next" class="pagination" @change="loadDialogues" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 状态编辑弹窗 -->
    <el-dialog v-model="stateDialogVisible" :title="stateForm.id ? '编辑状态' : '新增状态'" width="640px">
      <el-form :model="stateForm" label-width="110px">
        <el-form-item label="标识"><el-input v-model="stateForm.state_key" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="stateForm.name" /></el-form-item>
        <el-form-item label="所属场景">
          <el-select v-model="stateForm.scene_key" placeholder="全部场景" clearable style="width:220px;">
            <el-option v-for="s in scenesConfig.list" :key="s.key" :label="s.name" :value="s.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="Lottie"><el-input v-model="stateForm.lottie_url" placeholder="Lottie JSON 文件地址（非图片）" /></el-form-item>
        <el-form-item label="序列帧">
          <div style="width:100%;">
            <div class="option-row">
              <span style="margin-right:8px;">播放速率（fps）</span>
              <el-input-number v-model="stateForm.frame_rate" :min="1" :max="60" />
            </div>
            <div v-for="(frame, idx) in stateForm.frames_json" :key="idx" class="frame-row">
              <span class="frame-index">{{ idx + 1 }}</span>
              <ImageUpload v-model="stateForm.frames_json[idx]" width="64px" height="64px" />
              <el-button link type="primary" :disabled="idx === 0" @click="moveStateFrame(idx, -1)">上移</el-button>
              <el-button link type="primary" :disabled="idx === stateForm.frames_json.length - 1" @click="moveStateFrame(idx, 1)">下移</el-button>
              <el-button link type="danger" @click="stateForm.frames_json.splice(idx, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="stateForm.frames_json.push('')">+ 添加帧</el-button>
            <div style="color:#909399;font-size:12px;margin-top:6px;">上传 1 张为静态形象，多张按顺序播放序列帧</div>
          </div>
        </el-form-item>
        <el-form-item label="地图坐标">
          <div class="option-row">
            <span style="margin-right:8px;">X</span>
            <el-input-number v-model="stateForm.pos_x" :min="0" :max="2000" />
            <span style="margin:0 8px;">Y</span>
            <el-input-number v-model="stateForm.pos_y" :min="0" :max="2000" />
          </div>
          <div style="color:#909399;font-size:12px;margin-top:4px;">以背景图左上角为原点的地图坐标，取值范围见场景配置的坐标系说明</div>
        </el-form-item>
        <el-form-item label="尺寸">
          <div class="option-row">
            <span style="margin-right:8px;">宽</span>
            <el-input-number v-model="stateForm.width" :min="10" :max="1000" />
            <span style="margin:0 8px;">高</span>
            <el-input-number v-model="stateForm.height" :min="10" :max="1000" />
          </div>
        </el-form-item>
        <el-form-item label="持续时长（分）">
          <el-input-number v-model="stateForm.duration_minutes" :min="1" :max="1440" />
          <div style="color:#909399;font-size:12px;margin-top:4px;">进入该状态后持续多少分钟，期间刷新页面状态不变</div>
        </el-form-item>
        <el-form-item label="时段">
          <div style="width:100%;">
            <div v-for="(range, idx) in stateForm.time_ranges" :key="idx" class="option-row">
              <el-time-select v-model="range.start" placeholder="开始" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <span style="margin:0 8px;">至</span>
              <el-time-select v-model="range.end" placeholder="结束" start="00:00" step="00:30" end="23:59" style="width:140px;" />
              <el-button link type="danger" @click="stateForm.time_ranges.splice(idx, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="stateForm.time_ranges.push({ start: '08:00', end: '12:00' })">+ 添加时段</el-button>
          </div>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="stateForm.sort_order" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="stateForm.is_enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveState">保存</el-button>
      </template>
    </el-dialog>

    <!-- 运动编辑弹窗 -->
    <el-dialog v-model="exerciseDialogVisible" :title="exerciseForm.id ? '编辑运动' : '新增运动'" width="600px">
      <el-form :model="exerciseForm" label-width="110px">
        <el-form-item label="标识 key"><el-input v-model="exerciseForm.exercise_key" placeholder="如 jump_rope" :disabled="!!exerciseForm.id" /></el-form-item>
        <el-form-item label="运动名称"><el-input v-model="exerciseForm.name" /></el-form-item>
        <el-form-item label="是否使用器械">
          <el-switch v-model="exerciseForm.use_equipment" />
          <el-select v-if="exerciseForm.use_equipment" v-model="exerciseForm.equipment_item_id" placeholder="选择商城器材" style="margin-left:16px;width:240px;">
            <el-option v-for="item in equipmentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="运动动画">
          <ImageUpload v-model="exerciseForm.anim_url" tip="GIF/图片，用户点击运动后页面展示" />
        </el-form-item>
        <el-form-item label="是否跟练">
          <el-switch v-model="exerciseForm.has_workout" />
          <el-select v-if="exerciseForm.has_workout" v-model="exerciseForm.workout_key" placeholder="选择跟练课程（课程在「课程库」tab 维护）" style="margin-left:16px;width:240px;">
            <el-option v-for="w in workoutOptions" :key="w.workout_key" :label="w.name" :value="w.workout_key" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="exerciseForm.sort_order" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="exerciseForm.is_enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exerciseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExercise">保存</el-button>
      </template>
    </el-dialog>

    <!-- 对话编辑弹窗 -->
    <el-dialog v-model="dialogueDialogVisible" :title="dialogueForm.id ? '编辑对话' : '新增对话'" width="600px">
      <el-form :model="dialogueForm" label-width="100px">
        <el-form-item label="场景">
          <el-select v-model="dialogueForm.scene" placeholder="请选择场景" style="width:100%;">
            <el-option
              v-for="(item, key) in DIALOGUE_USAGE_MAP"
              :key="key"
              :label="`${item.label} (${key})`"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文本"><el-input v-model="dialogueForm.text" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="权重"><el-input-number v-model="dialogueForm.weight" :min="0" /></el-form-item>
        <el-form-item label="概率"><el-input-number v-model="dialogueForm.probability" :min="0" :max="1" :precision="2" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="dialogueForm.is_enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogueDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDialogue">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsPetConfigApi, cmsShopConfigApi, cmsWorkoutConfigApi, cmsCurrencyConfigApi } from '@/api/cms'
import ImageUpload from '@/components/ImageUpload.vue'
import WorkoutConfig from '@/views/workout-config/index.vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const activeTab = ref('schedules')
const defaultGlobal = { sleep_start: '22:00', sleep_end: '08:00', explore: { daily_max_count: 3 } }
const global = ref({ ...defaultGlobal })
// 每日日记分析消耗（原独立"分析消耗配置"页，合并到限制配置）
const analysisCost = ref({ berries: 50, flowers: 5 })

// 时段与限制配置
const schedules = ref({
  meals: [
    { key: 'breakfast', name: '早餐', start: '07:00', end: '09:00' },
    { key: 'lunch', name: '午餐', start: '11:30', end: '13:30' },
    { key: 'dinner', name: '晚餐', start: '17:30', end: '19:30' }
  ],
  exerciseWindows: [
    { key: 'evening', start: '19:30', end: '21:00' }
  ],
  explore: {
    windows: [
      { key: 'morning', start: '08:00', end: '11:00', probability: 0.3 },
      { key: 'afternoon', start: '14:00', end: '17:00', probability: 0.3 },
      { key: 'night', start: '20:00', end: '22:00', probability: 0.2 }
    ],
    daily_event_max: 5,
    home_event_chance_pct: 30
  },
  feed: { max_items_per_feed: 2, max_feeds_per_day: 6 },
  exerciseLimits: { max_per_day: 2 }
})

const states = ref([])
const stateTotal = ref(0)
const stateLoading = ref(false)
const stateQuery = ref({ keyword: '', page: 1, size: 20 })
const stateDialogVisible = ref(false)
const emptyStateForm = () => ({
  state_key: '', name: '', lottie_url: '', scene_key: '',
  frames_json: [], frame_rate: 2,
  pos_x: null, pos_y: null, width: null, height: null,
  time_ranges: [], duration_minutes: 30, sort_order: 0, is_enabled: true
})
const stateForm = ref(emptyStateForm())

const dialogues = ref([])
const dialogueTotal = ref(0)
const dialogueLoading = ref(false)
const dialogueQuery = ref({ keyword: '', page: 1, size: 20 })
const dialogueDialogVisible = ref(false)
const dialogueForm = ref({ scene: '', text: '', weight: 0, probability: 1, is_enabled: true })

onMounted(() => {
  loadGlobal()
  loadSchedules()
  loadSprite()
  loadScenes()
})

function onTabChange(tab) {
  if (tab === 'states' && !states.value.length) loadStates()
  if (tab === 'dialogues' && !dialogues.value.length) loadDialogues()
  if (tab === 'exercises' && !exerciseList.value.length) loadExercises()
}

// 全局配置
async function loadGlobal() {
  try {
    const res = await cmsPetConfigApi.getGlobal()
    const data = res.data || {}
    global.value = {
      ...defaultGlobal,
      ...data,
      explore: { ...defaultGlobal.explore, ...(data.explore || {}) }
    }
  } catch (e) { console.error(e) }
}

async function saveGlobal() {
  try {
    await cmsPetConfigApi.updateGlobal(global.value)
    ElMessage.success('保存成功')
  } catch (e) {
    console.error(e)
  }
}

// 时段与限制配置
async function loadSchedules() {
  try {
    const res = await cmsPetConfigApi.getSchedules()
    const data = res.data || {}
    if (data.pet_meal_times?.meals) schedules.value.meals = data.pet_meal_times.meals
    if (data.pet_exercise_time) {
      // 多时段结构；兼容旧的单时段 {start,end}
      if (Array.isArray(data.pet_exercise_time.windows) && data.pet_exercise_time.windows.length > 0) {
        schedules.value.exerciseWindows = data.pet_exercise_time.windows
      } else if (data.pet_exercise_time.start && data.pet_exercise_time.end) {
        schedules.value.exerciseWindows = [{ key: 'default', start: data.pet_exercise_time.start, end: data.pet_exercise_time.end }]
      }
    }
    if (data.pet_explore_times) {
      schedules.value.explore = {
        windows: data.pet_explore_times.windows || [],
        daily_event_max: data.pet_explore_times.daily_event_max || 5,
        home_event_chance_pct: data.pet_explore_times.home_event_chance_pct ?? 30
      }
    }
    if (data.pet_feed_limits) schedules.value.feed = data.pet_feed_limits
    if (data.pet_exercise_limits) schedules.value.exerciseLimits = data.pet_exercise_limits
    // 每日日记分析消耗（原独立"分析消耗配置"页，合并到此处）
    try {
      const costRes = await cmsCurrencyConfigApi.getAnalysisCost()
      analysisCost.value = {
        berries: costRes.data?.berries ?? 50,
        flowers: costRes.data?.flowers ?? 5
      }
    } catch (e) { console.error(e) }
  } catch (e) { console.error(e) }
}

async function saveSchedules() {
  try {
    // 时段相关配置
    const payload = {
      pet_meal_times: { meals: schedules.value.meals },
      pet_exercise_time: {
        windows: (schedules.value.exerciseWindows || []).filter(w => w.start && w.end)
      },
      pet_explore_times: {
        windows: schedules.value.explore?.windows || [],
        daily_event_max: schedules.value.explore?.daily_event_max ?? 5,
        home_event_chance_pct: schedules.value.explore?.home_event_chance_pct ?? 30
      },
      pet_feed_limits: schedules.value.feed,
      pet_exercise_limits: schedules.value.exerciseLimits
    }
    await cmsPetConfigApi.updateSchedules(payload)
    // 睡觉时间属于全局作息配置，一并保存
    if (global.value) {
      await cmsPetConfigApi.updateGlobal({
        sleep_start: global.value.sleep_start,
        sleep_end: global.value.sleep_end
      })
    }
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  }
}

async function saveLimits() {
  try {
    // 限制相关配置
    const payload = {
      pet_explore_times: {
        windows: schedules.value.explore?.windows || [],
        daily_event_max: schedules.value.explore?.daily_event_max ?? 5,
        home_event_chance_pct: schedules.value.explore?.home_event_chance_pct ?? 30
      },
      pet_feed_limits: schedules.value.feed,
      pet_exercise_limits: schedules.value.exerciseLimits
    }
    await cmsPetConfigApi.updateSchedules(payload)
    // 每日外出上限属于全局配置，一并保存
    if (global.value?.explore) {
      await cmsPetConfigApi.updateGlobal({
        explore: { daily_max_count: global.value.explore.daily_max_count }
      })
    }
    // 每日日记分析消耗
    await cmsCurrencyConfigApi.updateAnalysisCost({
      berries: analysisCost.value.berries ?? 0,
      flowers: analysisCost.value.flowers ?? 0
    })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  }
}

function addMeal() {
  schedules.value.meals.push({ key: `meal_${Date.now()}`, name: '加餐', start: '10:00', end: '11:00' })
}
function removeMeal(idx) {
  schedules.value.meals.splice(idx, 1)
}
function addExploreWindow() {
  schedules.value.explore.windows.push({ key: `win_${Date.now()}`, start: '12:00', end: '14:00', probability: 0.2 })
}
function removeExploreWindow(idx) {
  schedules.value.explore.windows.splice(idx, 1)
}

// 形象配置（坐标/序列帧/播放速率）
const sprite = ref({ x: 375, y: 500, width: 380, height: 380, fps: 2, frames: [] })

async function loadSprite() {
  try {
    const res = await cmsPetConfigApi.getSprite()
    const data = res.data || {}
    sprite.value = {
      x: data.x ?? 375,
      y: data.y ?? 500,
      width: data.width ?? 380,
      height: data.height ?? 380,
      fps: data.fps ?? 2,
      frames: Array.isArray(data.frames) ? [...data.frames] : []
    }
  } catch (e) { console.error(e) }
}

async function saveSprite() {
  try {
    const frames = sprite.value.frames.filter(f => f && String(f).trim())
    await cmsPetConfigApi.updateSprite({ ...sprite.value, frames })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  }
}

function moveFrame(idx, dir) {
  const target = idx + dir
  if (target < 0 || target >= sprite.value.frames.length) return
  const arr = sprite.value.frames
  const tmp = arr[idx]
  arr[idx] = arr[target]
  arr[target] = tmp
}

function moveStateFrame(idx, dir) {
  const frames = stateForm.value.frames_json
  const target = idx + dir
  if (target < 0 || target >= frames.length) return
  const tmp = frames[idx]
  frames[idx] = frames[target]
  frames[target] = tmp
}

// 场景配置（名称/时段背景图/比例）
const scenesConfig = ref({ default: 'room', list: [] })

async function loadScenes() {
  try {
    const res = await cmsPetConfigApi.getScenes()
    const data = res.data || {}
    scenesConfig.value = {
      default: data.default || 'room',
      list: Array.isArray(data.list) ? data.list.map(s => ({
        key: s.key || '',
        name: s.name || '',
        bg_day: s.bg_day || '',
        bg_evening: s.bg_evening || '',
        bg_night: s.bg_night || '',
        bg_height: s.bg_height ?? 1450,
        bg_aspect: s.bg_aspect ?? 0.9694
      })) : []
    }
  } catch (e) { console.error(e) }
}

async function saveScenes() {
  try {
    for (const s of scenesConfig.value.list) {
      if (!s.key || !s.name) {
        ElMessage.error('每个场景都必须填写标识和名称')
        return
      }
    }
    await cmsPetConfigApi.updateScenes(scenesConfig.value)
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  }
}

function addScene() {
  scenesConfig.value.list.push({
    key: `scene_${Date.now()}`,
    name: '新场景',
    bg_day: '',
    bg_evening: '',
    bg_night: '',
    bg_height: 1450,
    bg_aspect: 0.9694
  })
}

// 状态库
function formatTimeRanges(ranges) {
  if (!Array.isArray(ranges) || !ranges.length) return ''
  return ranges.map(t => `${t.start}-${t.end}`).join('，')
}

const DIALOGUE_USAGE_MAP = {
  pet_tap: { label: '搭搭页-点击宠物', type: 'success' },
  task_reward: { label: '奖励提示-任务', type: 'warning' },
  checkin_reward: { label: '奖励提示-签到', type: 'warning' },
  achievement_reward: { label: '奖励提示-成就', type: 'warning' },
  milestone_reward: { label: '奖励提示-里程碑', type: 'warning' },
  newbie_task_reward: { label: '奖励提示-新手任务', type: 'warning' },
  joy_event: { label: '奖励提示-小确幸', type: 'warning' },
  weight_goal_reached: { label: '奖励提示-目标体重', type: 'warning' },
  feed: { label: '暂无调用', type: 'info' },
  play: { label: '暂无调用', type: 'info' },
  hug: { label: '暂无调用', type: 'info' },
  explore_return: { label: '暂无调用', type: 'info' },
  reward: { label: '暂无调用', type: 'info' },
  greet: { label: '暂无调用', type: 'info' }
}

function dialogueUsageLabel(scene) {
  return DIALOGUE_USAGE_MAP[scene]?.label || scene
}

function dialogueUsageType(scene) {
  return DIALOGUE_USAGE_MAP[scene]?.type || 'info'
}

async function loadStates() {
  stateLoading.value = true
  try {
    const res = await cmsPetConfigApi.listStates(stateQuery.value)
    states.value = res.data.list
    stateTotal.value = res.data.pagination.total
  } finally { stateLoading.value = false }
}

function openStateDialog(row = null) {
  if (!row) {
    stateForm.value = emptyStateForm()
  } else {
    const frames = Array.isArray(row.frames_json) ? row.frames_json : []
    stateForm.value = {
      ...row,
      frames_json: frames.map(f => f),
      frame_rate: row.frame_rate ?? 2,
      pos_x: row.pos_x ?? null,
      pos_y: row.pos_y ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      scene_key: row.scene_key || '',
      time_ranges: Array.isArray(row.time_ranges) ? row.time_ranges.map(t => ({ ...t })) : [],
      duration_minutes: row.duration_minutes ?? 30,
      is_enabled: !!row.is_enabled
    }
  }
  stateDialogVisible.value = true
}

async function saveState() {
  try {
    const data = { ...stateForm.value }
    data.time_ranges = (data.time_ranges || []).filter(t => t.start && t.end)
    data.frames_json = (data.frames_json || []).filter(f => f && String(f).trim())
    // 确保启用状态以 0/1 数字提交，避免字符串/undefined 导致后端 COALESCE 不更新
    data.is_enabled = data.is_enabled ? 1 : 0
    delete data.mood_range
    if (data.id) await cmsPetConfigApi.updateState(data.id, data)
    else await cmsPetConfigApi.createState(data)
    ElMessage.success('保存成功')
    stateDialogVisible.value = false
    await loadStates()
  } catch (e) {
    console.error(e)
  }
}

async function removeState(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsPetConfigApi.removeState(row.id)
    ElMessage.success('删除成功')
    loadStates()
  } catch (e) {}
}

// 运动库
const exerciseList = ref([])
const exerciseTotal = ref(0)
const exerciseLoading = ref(false)
const exerciseQuery = ref({ keyword: '', page: 1, size: 20 })
const exerciseDialogVisible = ref(false)
const emptyExerciseForm = () => ({ exercise_key: '', name: '', use_equipment: false, equipment_item_id: null, anim_url: '', has_workout: false, workout_key: null, sort_order: 0, is_enabled: true })
const exerciseForm = ref(emptyExerciseForm())
const equipmentOptions = ref([])
const workoutOptions = ref([])

async function loadExercises() {
  exerciseLoading.value = true
  try {
    const res = await cmsPetConfigApi.listExercises(exerciseQuery.value)
    exerciseList.value = res.data.list
    exerciseTotal.value = res.data.pagination.total
  } finally { exerciseLoading.value = false }
}

async function loadExerciseFormOptions() {
  try {
    const [shopRes, workoutRes] = await Promise.all([
      cmsShopConfigApi.list({ category: 'equipment', page: 1, size: 100 }),
      cmsWorkoutConfigApi.list({ page: 1, size: 100 })
    ])
    equipmentOptions.value = shopRes.data.list || []
    workoutOptions.value = (workoutRes.data.list || []).filter(w => w.status)
  } catch (e) { console.error(e) }
}

function openExerciseDialog(row = null) {
  exerciseForm.value = row
    ? { ...row, use_equipment: !!row.use_equipment, has_workout: !!row.has_workout, is_enabled: !!row.is_enabled }
    : emptyExerciseForm()
  if (!equipmentOptions.value.length && !workoutOptions.value.length) loadExerciseFormOptions()
  exerciseDialogVisible.value = true
}

async function saveExercise() {
  const f = exerciseForm.value
  if (!f.exercise_key || !f.name) return ElMessage.error('请填写运动 key 和名称')
  if (f.use_equipment && !f.equipment_item_id) return ElMessage.error('请选择器械')
  if (f.has_workout && !f.workout_key) return ElMessage.error('请选择跟练课程')
  try {
    const data = { ...f, is_enabled: f.is_enabled ? 1 : 0 }
    if (data.id) await cmsPetConfigApi.updateExercise(data.id, data)
    else await cmsPetConfigApi.createExercise(data)
    ElMessage.success('保存成功')
    exerciseDialogVisible.value = false
    await loadExercises()
  } catch (e) { console.error(e) }
}

async function removeExercise(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsPetConfigApi.removeExercise(row.id)
    ElMessage.success('删除成功')
    loadExercises()
  } catch (e) {}
}

// 对话库
async function loadDialogues() {
  dialogueLoading.value = true
  try {
    const res = await cmsPetConfigApi.listDialogues(dialogueQuery.value)
    dialogues.value = res.data.list
    dialogueTotal.value = res.data.pagination.total
  } finally { dialogueLoading.value = false }
}

function openDialogueDialog(row = null) {
  dialogueForm.value = row
    ? { ...row, is_enabled: !!row.is_enabled }
    : { scene: '', text: '', weight: 0, probability: 1, is_enabled: true }
  dialogueDialogVisible.value = true
}

async function saveDialogue() {
  try {
    if (dialogueForm.value.id) await cmsPetConfigApi.updateDialogue(dialogueForm.value.id, dialogueForm.value)
    else await cmsPetConfigApi.createDialogue(dialogueForm.value)
    ElMessage.success('保存成功')
    dialogueDialogVisible.value = false
    loadDialogues()
  } catch (e) { console.error(e) }
}

async function removeDialogue(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsPetConfigApi.removeDialogue(row.id)
    ElMessage.success('删除成功')
    loadDialogues()
  } catch (e) {}
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
.schedule-form :deep(.el-form-item) { margin-bottom: 12px; }
.meal-row { display: flex; align-items: center; margin-bottom: 12px; }
.option-row { display: flex; align-items: center; margin-bottom: 8px; }
.frame-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.frame-index { width: 24px; text-align: center; color: #909399; }
.scene-card { border: 1px solid #ebeef5; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
.scene-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.scene-bg-row { display: flex; gap: 12px; }
.scene-bg-item { flex: 1; }
.scene-bg-preview { width: 100%; height: 90px; margin-top: 6px; border-radius: 4px; }
</style>
