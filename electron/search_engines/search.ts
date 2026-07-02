import { localBaiduSearch } from "./baidu";
import { SearchResult } from "./utils";
import { localDuckDuckGoSearch } from "./duckduckgo";
import { localSogouSearch } from "./sogou";
import { local360Search } from "./so360";
import { localYouchannelsSearch } from "./youchannels";
import { pub } from '../class/public'
import { agentService } from '../service/agent';


// 获取模板常量
const getTemplate = (agent_name:string):{ DEEPSEEK_PROMPT_TPL:string, DEEPSEEK_SYSTEM_PROMPT_TPL:string, OTHER_PROMPT_TPL:string, OTHER_SYSTEM_PROMPT_TPL:string, QUERY_PROMPT_TPL:string } => {
    agent_name = agent_name || '';
    let agentInfo = agentService.get_agent_config(agent_name);
    // 提取模板常量
    const TEMPLATES_LANG = [
        agentInfo?agentInfo.prompt:pub.lang('以下内容是基于用户发送的消息的搜索结果'),
        pub.lang('在我给你的搜索结果中，每个结果都是[搜索结果 X begin]...[搜索结果 X end]格式的，X代表每篇文章的数字索引。另外搜索结果中可能包含一些不相关的信息，你可以根据需要选择其中的内容。'),
        pub.lang('在回答时，请注意以下几点'),
        pub.lang('今天是'),
        pub.lang('用户所在地点是'),
        agentInfo?'':pub.lang('不要在回答内容中提及搜索结果的具体来源，也不要提及搜索结果的具体排名。'),
        agentInfo?'':pub.lang('并非搜索结果的所有内容都与用户的问题密切相关，你需要结合问题，对搜索结果进行甄别、筛选。'),
        agentInfo?'':pub.lang('对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看搜索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户搜索结果未提供的内容。'),
        agentInfo?'':pub.lang('对于创作类的问题（如写论文），你需要解读并概括用户的题目要求，选择合适的格式，充分利用搜索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。'),
        agentInfo?'':pub.lang('如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。'),
        agentInfo?'':pub.lang('对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。'),
        agentInfo?'':pub.lang('你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。'),
        agentInfo?'':pub.lang('你的回答应该综合多个相关网页来回答，不能重复引用一个网页。'),
        agentInfo?'':pub.lang('除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。'),
        pub.lang('用户消息为'),
    ]

    const OTHER_SYSTEM_PROMPT_TPL_LANG = [
        agentInfo?agentInfo.prompt:pub.lang('你是一个擅长搜索网络和回答用户查询的人工智能模型。'),
        pub.lang('在回答时，请注意以下几点'),
        pub.lang('根据提供的搜索结果生成信息丰富且与用户查询相关的回答。'),
        pub.lang('当前日期和时间为'),
        pub.lang('用户所在地区为'),
        agentInfo?'':pub.lang('不要在回答内容中提及搜索结果的具体来源，也不要提及搜索结果的具体排名。'),
        agentInfo?'':pub.lang('并非搜索结果的所有内容都与用户的问题密切相关，你需要结合问题，对搜索结果进行甄别、筛选。'),
        agentInfo?'':pub.lang('对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看搜索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户搜索结果未提供的内容。'),
        agentInfo?'':pub.lang('对于创作类的问题（如写论文），你需要解读并概括用户的题目要求，选择合适的格式，充分利用搜索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。'),
        agentInfo?'':pub.lang('如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。'),
        agentInfo?'':pub.lang('对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。'),
        agentInfo?'':pub.lang('你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。'),
        agentInfo?'':pub.lang('你的回答应该综合多个相关网页来回答，不能重复引用一个网页。'),
        agentInfo?'':pub.lang('除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。'),
        pub.lang('以下内容是基于用户发送的消息的搜索结果'),
    ]


    const QUERY_PROMPT_TPL_LANG = [
        pub.lang('根据用户的问题，和上一个对话的内容，理解用户意图，生成一个用于搜索引擎搜索的问题，这个问题的搜索结果将会用于帮助智能模型回答用户问题，回答内容中只有一个问题，且只包含问题内容，不包含其它信息。'),
        pub.lang('今天的时间是'),
        pub.lang('用户所在地点是'),
        pub.lang('上一个对话'),
        pub.lang('后续问题'),
        pub.lang('用于搜索的问题'),
    ]



    const DEEPSEEK_PROMPT_TPL = `# ${TEMPLATES_LANG[0]}:
{search_results}
${TEMPLATES_LANG[1]}
${TEMPLATES_LANG[2]}:
- ${TEMPLATES_LANG[3]}{current_date_time}。
- ${TEMPLATES_LANG[4]}{user_location}。
- ${TEMPLATES_LANG[5]}
- ${TEMPLATES_LANG[6]}
- ${TEMPLATES_LANG[7]}
- ${TEMPLATES_LANG[8]}
- ${TEMPLATES_LANG[9]}
- ${TEMPLATES_LANG[10]}
- ${TEMPLATES_LANG[11]}
- ${TEMPLATES_LANG[12]}
- ${TEMPLATES_LANG[13]}

{doc_files}

# ${TEMPLATES_LANG[14]}:
{question}`

    const DEEPSEEK_SYSTEM_PROMPT_TPL = ""
    const OTHER_PROMPT_TPL = "{question}"

    const OTHER_SYSTEM_PROMPT_TPL = `# ${OTHER_SYSTEM_PROMPT_TPL_LANG[0]}:
## ${OTHER_SYSTEM_PROMPT_TPL_LANG[1]}:
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[2]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[3]} {current_date_time}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[4]} {user_location}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[5]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[6]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[7]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[8]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[9]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[10]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[11]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[12]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[13]}

## ${OTHER_SYSTEM_PROMPT_TPL_LANG[14]}:
<search-results>
{search_results}
</search-results>
{doc_files}`

    const  QUERY_PROMPT_TPL = `# ${QUERY_PROMPT_TPL_LANG[0]}
## ${QUERY_PROMPT_TPL_LANG[1]}: {current_date_time}
## ${QUERY_PROMPT_TPL_LANG[2]}: {user_location}
## ${QUERY_PROMPT_TPL_LANG[3]}:
{chat_history}

## ${QUERY_PROMPT_TPL_LANG[4]}: {question}
${QUERY_PROMPT_TPL_LANG[5]}:`
    


    return { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL, QUERY_PROMPT_TPL }
}

// 搜索引擎映射
export const searchEngines = {
    baidu: localBaiduSearch,
    duckduckgo: localDuckDuckGoSearch,
    sogou: localSogouSearch,
    sougou: localSogouSearch,
    google: local360Search,
    so360: local360Search,
    360: local360Search,
    youchannels: localYouchannelsSearch,
};

// 搜索网页函数
export const searchWeb = async (provider: string, query: string): Promise<SearchResult[]> => {
    let queryKey = pub.md5(`${provider}-${query}`);
    // 本地搜索缓存
    let cache = pub.cache_get(queryKey);
    if (cache) {
        return cache;
    }
    if (!searchEngines[provider]) {
        throw new Error(`Search provider ${provider} not found`);
    }
    const searchResults = await searchEngines[provider](query);
    // 设置搜索结果缓存
    pub.cache_set(queryKey, searchResults, 3600);
    return searchResults;
};

// 获取当前日期时间字符串
const getCurrentDateTime = () => {
    // 获取当前日期时间
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // 星期几
    const weekDay = [
        pub.lang('星期日'), 
        pub.lang('星期一'), 
        pub.lang('星期二'),
        pub.lang('星期三'), 
        pub.lang('星期四'), 
        pub.lang('星期五'), 
        pub.lang('星期六')][now.getDay()];

    // 上午/下午
    const ampm = hour < 12 ? pub.lang('上午') : pub.lang('下午');

    return `${year}-${month}-${day} ${hour}:${minute}:${second} -- ${ampm}  ${weekDay}`;
}

// 获取用户所在地区
const getUserLocation = () => {
    if(pub.get_language() == 'zh'){
        return global.area || pub.lang("未知地区");
    }
    return pub.lang("未知地区");
}

// 获取用于搜索的问题
export const getSearchQuery = async (query: string, model: string, chatHistory: string): Promise<string> => {
    // try {
        // 调整为直接响应
        return query;


    //     if (chatHistory.length === 0) {
    //         return query;
    //     }

    //     // query最后一个字符是问号，直接返回
    //     if (query[query.length - 1] === '？' || query[query.length - 1] === '?') {
    //         return query;
    //     }

    //     const currentDateTime = getCurrentDateTime();
    //     const userLocation = getUserLocation();
    //     const { QUERY_PROMPT_TPL } = getTemplate();
    //     const queryPrompt = QUERY_PROMPT_TPL
    //        .replace("{question}", query)
    //        .replace("{chat_history}", chatHistory)
    //        .replace("{current_date_time}", currentDateTime)
    //        .replace("{user_location}", userLocation);

    //     const res = await ollama.generate({
    //         prompt: queryPrompt,
    //         model: model
    //     });

    //     let result = res.response;
    //     if(!result) return query;
    //     if (result.indexOf('</think>') !== -1) {
    //         result = result.split('</think>')[1].trim();
    //     }

    //     let lines = result.trim().split('\n');
    //     result = lines[lines.length - 1].trim();
    //     return result;
    // } catch (error) {
    //     console.error('Error getting search query:', error);
    //     return query
    // }
};

// 生成 DeepSeek 类型的提示信息
const generateDeepSeekPrompt = (searchResultList: SearchResult[], query: string,doc_files:string[],agent_name:string): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();

    const search_results = searchResultList.map(
        (result, idx) =>
            `[${pub.lang('搜索结果')} ${idx+1} begin]
${pub.lang('连接')}: ${result.link}
${pub.lang('标题')}: ${result.title}
${pub.lang('内容')}:${result.content}
[${pub.lang('搜索结果')} ${idx} end]`
    ).join("\n");


    let doc_files_str = doc_files.map(
        (doc_file, idx) =>
            `[${pub.lang('用户文档')} ${idx+1} begin]
${pub.lang('内容')}: ${doc_file}
[${pub.lang('用户文档')} ${idx} end]`
    ).join("\n");


    doc_files_str = `${pub.lang('以下是用户上传的文档内容，每个文档内容都是[用户文档 X begin]...[用户文档 X end]格式的，你可以根据需要选择其中的内容。')}
${doc_files_str}`


    const { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
    const userPrompt = DEEPSEEK_PROMPT_TPL
       .replace("{search_results}", search_results)
       .replace("{current_date_time}", currentDateTime)
       .replace("{question}", query)
       .replace("{user_location}", userLocation)
         .replace("{doc_files}", doc_files_str);

    const systemPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL;

    return { userPrompt, systemPrompt, searchResultList,query };
};

// 生成其他类型的提示信息
const generateOtherPrompt = (searchResultList: SearchResult[], query: string,doc_files:string[],agent_name): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();

    const search_results = searchResultList.map(
        (result, idx) =>
            `<result source="${result.link}" id="${idx+1}">${result.content}</result>`
    ).join("\n");
    
    let doc_files_str = doc_files.map(
        (doc_file, idx) =>
            `<doc source="${doc_file}" id="${idx+1}">${doc_file}</doc>`
    ).join("\n");
    doc_files_str = `${pub.lang('以下是用户上传的文档内容')}
<doc_files>
${doc_files_str}
</doc_files>`;

    const { OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
    const systemPrompt = OTHER_SYSTEM_PROMPT_TPL
       .replace("{search_results}", search_results)
       .replace("{current_date_time}", currentDateTime)
       .replace("{user_location}", userLocation)
         .replace("{doc_files}", doc_files_str)

    const userPrompt = OTHER_PROMPT_TPL.replace("{question}", query);
    return { userPrompt, systemPrompt ,searchResultList,query};
};


// 获取默认提示信息
export const getDefaultPrompt = (query: string,model:string,agent_name:string): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    let userPrompt = '';
    let systemPrompt = '';
    let searchResultList = [];
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();
    const { DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
    if (model.indexOf("deepseek") !== -1) {
        userPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL
        .replace("{current_date_time}", currentDateTime)
        .replace("{user_location}", userLocation)
        .replace("{question}", query)
        .replace("{search_results}", '');
    }else{
        systemPrompt = OTHER_SYSTEM_PROMPT_TPL
        .replace("{current_date_time}", currentDateTime)
        .replace("{user_location}", userLocation)
        .replace("{question}", query)
        .replace("{search_results}", '');
    }

    return { userPrompt, systemPrompt,searchResultList,query };
}

// 获取网页搜索提示信息
export const getPromptForWeb = async (query: string, model: string, chatHistory: string,doc_files:string[],agent_name:string,searchResultList?:any[],searchProvider?: string): Promise<{ userPrompt: string; systemPrompt: string;searchResultList:any,query:string }> => {
    try {
        if(query.length < 4) return getDefaultPrompt(query,model,agent_name);
        const searchQuery = await getSearchQuery(query, model, chatHistory);
        if(!searchResultList || !searchResultList.length){
            if(searchProvider){
                searchResultList = await searchWeb(searchProvider, searchQuery);
            }
        }

        if(agent_name){
            // 如果是智能体，只保留3个搜索结果，且内容长度不超过4096个字符
            searchResultList = searchResultList.slice(0,3);
            searchResultList = searchResultList.map((result) => {
                result.content = result.content.slice(0,4096);
                return result;
            });
        }

        if (model.indexOf("deepseek") !== -1) {
            return generateDeepSeekPrompt(searchResultList, searchQuery,doc_files,agent_name);
        } else {
            return generateOtherPrompt(searchResultList, searchQuery,doc_files,agent_name);
        }
    } catch (error) {
        console.error('Error getting prompt for web:', error);
        throw new Error('Failed to get prompt for web');
    }
};


// 搜索函数
// 直接搜索网页，返回搜索结果列表
export const search = async (query:string,searchProvider:string):Promise<SearchResult[]> => {
    try {
        let searchResultList = await searchWeb(searchProvider, query);
        // 去除空标题
        searchResultList = searchResultList.filter((result) => {
            return result.title && result.title.length > 0;
        });
        return searchResultList;
    } catch (error) {
        console.error('Error searching:', error);
    }
    return [];
}