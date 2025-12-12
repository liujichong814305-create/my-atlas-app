
// Mock Authentication & Cloud Storage Service

export interface UserAccount {
    id: string;
    username: string;
    method: 'wechat' | 'phone' | 'guest';
    avatar?: string;
}

export interface CloudData {
    profile: any;
    dailyMessages: any[];
    deepSupportMessages: any[];
    deepAnalysisMessages: any[]; // Added
    learningMessages: any[];
    privateMessages: any[]; // Added
}

// Simulate Cloud Database
const MOCK_CLOUD_DB: Record<string, CloudData> = {};

export const loginUser = async (method: 'wechat' | 'phone'): Promise<UserAccount> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (method === 'wechat') {
        return {
            id: 'wx_user_123456',
            username: 'WeChat User',
            method: 'wechat',
            avatar: undefined // Would come from Wechat
        };
    } else {
        return {
            id: 'ph_user_987654',
            username: 'Mobile User',
            method: 'phone'
        };
    }
};

export const syncDataToCloud = async (userId: string, data: CloudData): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload
    try {
        localStorage.setItem(`atlas_cloud_${userId}`, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
};

export const restoreDataFromCloud = async (userId: string): Promise<CloudData | null> => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate download
    try {
        const raw = localStorage.getItem(`atlas_cloud_${userId}`);
        if (!raw) return null;
        
        const parsed = JSON.parse(raw);
        // Migration/Safety check for older data structures
        return {
            profile: parsed.profile,
            dailyMessages: parsed.dailyMessages || [],
            deepSupportMessages: parsed.deepSupportMessages || [],
            deepAnalysisMessages: parsed.deepAnalysisMessages || [],
            learningMessages: parsed.learningMessages || [],
            privateMessages: parsed.privateMessages || []
        };
    } catch (e) {
        return null;
    }
};
