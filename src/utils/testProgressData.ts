import { progressService } from '../services/progressService';
import { documentService } from '../services/documentService';
import type { Suggestion } from '../types/suggestion';

// Sample documents with different quality levels to show improvement over time
const sampleDocuments = [
  // Early documents (poor quality - these will be "previous")
  {
    title: "My First Essay",
    content: `This is my frist essay about environement. I think polution is bad and we shoud do somthing about it. There are many reasons why we need to protect nature. 

First, animals are loosing there homes. The forrest are being cut down and this makes me sad. We need to be more carefull about what we do.

Second, the air is getting dirty. Cars and factorys make smoke that is bad for us. We should walk more and use less cars.

In concluson, we need to help the environement. Every person can make a differance. We should recyle and not litter. This will make the world beter for everyone.`,
    errors: 15, // Many spelling/grammar errors
  },
  {
    title: "Technology in Schools",
    content: `Tecnology is realy importent in scools today. I think computors help studants lern beter. Ther are many benifits to using tecnology in eductaion.

First, studants can acces informaton faster. The internent has lots of resorces that can help with reserch projets. Teachors can use onlien tools to make lesons more intresting.

Second, tecnology prepars studants for the futur. In todays world, most jobs requir computor skils. Studants shold lern thes skils at a yung age.

Finaly, tecnology makes lerning more fun. Educatonal games and interativ programs keep studants engagd. This helps them rember what they lern beter.

In concluson, tecnology has many benifits for eductaion. Scools shold continu to use computors and other tecnology to help studants suced.`,
    errors: 18, // Poor quality
  },
  {
    title: "My Summer Vacation",
    content: `Last sumer I went on a grate vacaton with my famly. We traveld to the beech and had alot of fun. Ther wer many thing to do and see.

On the frist day, we checkd into our hotl. The room was nice and had a beutiful view of the oshen. We unpakd our bags and went strait to the beech. The sand was warm and the watr felt grate.

We enjoyd many activitys during our trip. We went swiming every day and bilt sand castls. My brothr and I colectd shels along the shor. In the evenings, we walkd on the bordwalk and ate ice crem.

One day we took a bot tour to see dolpins. It was amasing to see thes beutiful anmals in ther natral habitat. We also visitd a ligt hous and lernd about its histery.

The vacaton went by to fast. I was sad when it was tim to go hom. But I mad many grate memorys that I wil never forgt. I hop we can go bak ther agan next yer.`,
    errors: 22, // Very poor quality
  },
  {
    title: "Benefits of Reading",
    content: `Reding is one of the most importent skils a persn can hav. I belev that reding books regulerly has many benifits for peple of all ages. Ther ar sevrl resons why evry one shold mak reding a part of ther daly routin.

Frist, reding imprvs vocabulery and languag skils. When we red differnt typs of books, we encuntr new words and lern how to us them corectly. This helps us comuncat beter in both spking and wrting.

Secnd, reding stimulats the bran and imprvs concentraton. Studys hav shown that peple who red regulerly hav beter memry and ar abl to focs for longr perods of tim. This is espshly importent for studnts who ned to concentrat on ther studys.

Thrd, reding provids entrtanmnt and relaksaton. A gud book can tranport us to differnt worlds and help us forgt about our problms for a whil. This is a helthy way to manag stres and improv our mentl helth.

Finly, reding expnds our knowlg and undrstandng of the world. Books teech us about differnt culturs, histery, and idas. This helps us becom mor open-mindd and infrmmd citizns.

In concluon, reding has many benifits that can improv our livs in many ways. I encurag evry on to mak tim for reding evry day.`,
    errors: 25, // Worst quality
  },
  {
    title: "The Importance of Exercise",
    content: `Exercis is realy importent for good helth. I think evry persn shold do som typ of fysicl activty evry day. Ther ar many resns why exercis is gud for us.

Frist, exercis helps kep our bodys strong and helthy. When we exercis regulerly, our hart gets strongr and our muscls becom mor fit. This helps us hav mor enrgy and fel beter overal.

Secnd, exercis can help us manag our wat. If we eat to much and dont exercis, we myt gain unwantd wat. But if we exercis and eat helthy fuds, we can maintayn a gud wat.

Thrd, exercis is gud for our mentl helth. When we exercis, our bodys releas chemlcals that mak us fel hapy and relaksd. This can help reduc stres and anxity.

Finly, exercis can be fun and socl. We can exercis with frends or famly mmbrs, which maks it mor enjobl. Ther ar many differnt typs of exercis to chos from, so evry on can fynd somthng they lik.

In concluon, exercis has many benifits for both our fysicl and mentl helth. Evry on shold try to mak exercis a part of ther daly routin.`,
    errors: 20, // Poor quality
  },
  {
    title: "Environmental Protection Essay",
    content: `Environmental protection is crucial for our planet's future. I believe pollution poses a significant threat and we should take action immediately. There are many compelling reasons why we need to protect our natural world.

First, wildlife habitats are being destroyed. Forests are being cut down at alarming rates, which makes me concerned about biodiversity loss. We need to be more careful about our impact on ecosystems.

Second, air quality is deteriorating rapidly. Cars and factories produce emissions that are harmful to human health. We should walk more frequently and reduce our reliance on vehicles.

In conclusion, we must prioritize environmental protection. Every individual can make a meaningful difference. We should recycle consistently and avoid littering. This will create a better world for future generations.`,
    errors: 3, // Much fewer errors - showing improvement
  },
  {
    title: "Climate Change Solutions",
    content: `Climate change represents one of the most pressing challenges of our time. The scientific consensus overwhelmingly supports the need for immediate action to mitigate its effects. There are several effective strategies we can implement to address this global crisis.

Renewable energy sources offer the most promising path forward. Solar and wind technologies have become increasingly cost-effective, making them viable alternatives to fossil fuels. Governments should incentivize the transition to clean energy through policy reforms and financial incentives.

Additionally, sustainable transportation systems can significantly reduce carbon emissions. Electric vehicles, improved public transit, and bicycle infrastructure represent practical solutions that cities can implement immediately.

Furthermore, individual actions collectively create substantial impact. Conservation efforts, responsible consumption, and advocacy for environmental policies demonstrate how citizens can contribute meaningfully to climate solutions.

In conclusion, addressing climate change requires coordinated efforts at multiple levels. Through technological innovation, policy reform, and individual responsibility, we can create a sustainable future for subsequent generations.`,
    errors: 0, // Perfect - showing continued improvement
  },
  {
    title: "Sustainable Living Practices",
    content: `Sustainable living practices have become essential in our modern world. As environmental awareness increases, individuals are seeking practical ways to reduce their ecological footprint. Implementing sustainable habits can significantly benefit both personal well-being and planetary health.

Energy conservation represents a fundamental aspect of sustainable living. Simple actions like using LED lighting, unplugging electronics when not in use, and optimizing heating and cooling systems can substantially reduce energy consumption. These practices not only benefit the environment but also result in lower utility costs.

Water conservation equally deserves attention in sustainable living approaches. Installing low-flow fixtures, collecting rainwater for gardening, and fixing leaks promptly can conserve this precious resource. Additionally, choosing drought-resistant plants for landscaping reduces irrigation requirements.

Waste reduction strategies further enhance sustainable living practices. Composting organic waste, choosing reusable products over disposable alternatives, and buying items with minimal packaging all contribute to reducing landfill burden.

In conclusion, sustainable living involves conscious choices that collectively create positive environmental impact. Through consistent implementation of these practices, individuals can contribute meaningfully to environmental preservation while often saving money and improving quality of life.`,
    errors: 1, // Maintaining high quality
  }
];

// Function to generate mock AI suggestions based on error count
function generateMockSuggestions(content: string, errorCount: number): Suggestion[] {
  const words = content.split(/\s+/);
  const suggestions: Suggestion[] = [];
  
  // Generate spelling errors
  const spellingErrors = Math.floor(errorCount * 0.6); // 60% spelling
  for (let i = 0; i < spellingErrors; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    suggestions.push({
      id: `spelling_${i}`,
      type: 'spelling',
      category: 'error',
      severity: 'medium',
      originalText: words[randomIndex] || 'word',
      suggestedText: words[randomIndex] || 'word',
      startIndex: randomIndex * 10,
      endIndex: randomIndex * 10 + 5,
      confidence: 0.9,
      explanation: 'Spelling correction suggested',
      documentId: '',
      userId: '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  // Generate grammar errors
  const grammarErrors = Math.floor(errorCount * 0.4); // 40% grammar
  for (let i = 0; i < grammarErrors; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    suggestions.push({
      id: `grammar_${i}`,
      type: 'grammar',
      category: 'error',
      severity: 'high',
      originalText: words[randomIndex] || 'word',
      suggestedText: words[randomIndex] || 'word',
      startIndex: randomIndex * 10,
      endIndex: randomIndex * 10 + 5,
      confidence: 0.85,
      explanation: 'Grammar improvement suggested',
      documentId: '',
      userId: '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  // Add some clarity and engagement suggestions
  const otherSuggestions = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < otherSuggestions; i++) {
    suggestions.push({
      id: `clarity_${i}`,
      type: Math.random() > 0.5 ? 'clarity' : 'engagement',
      category: 'improvement',
      severity: 'low',
      originalText: 'sample text',
      suggestedText: 'improved text',
      startIndex: 100,
      endIndex: 110,
      confidence: 0.75,
      explanation: 'Style improvement suggested',
      documentId: '',
      userId: '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  return suggestions;
}

// Main test function
export async function generateTestProgressData(userId: string): Promise<void> {
  console.log('🧪 Starting progress data test generation...');
  
  try {
    // Create sample documents over time (simulate documents created over past weeks)
    const documentIds: string[] = [];
    
    for (let i = 0; i < sampleDocuments.length; i++) {
      const sample = sampleDocuments[i];
      console.log(`📝 Creating test document ${i + 1}: "${sample.title}"`);
      
      // Create document
      const documentId = await documentService.createDocument(
        userId,
        sample.title,
        sample.content
      );
      documentIds.push(documentId);
      
      // Generate mock suggestions based on error count
      const suggestions = generateMockSuggestions(sample.content, sample.errors);
      
      // Calculate quality metrics
      const document = {
        id: documentId,
        title: sample.title,
        content: sample.content,
        wordCount: sample.content.split(/\s+/).length,
        userId,
        createdAt: new Date(Date.now() - (sampleDocuments.length - i) * 7 * 24 * 60 * 60 * 1000), // Space out over weeks
        updatedAt: new Date()
      };
      
      const qualityMetrics = progressService.calculateQualityMetrics(document, suggestions);
      
      // Store quality metrics
      await progressService.storeQualityMetrics(userId, documentId, {
        errorRate: qualityMetrics.errorRate,
        suggestionDensity: qualityMetrics.suggestionDensity,
        wordCount: qualityMetrics.wordCount
      });
      
      console.log(`✅ Document "${sample.title}" created with ${qualityMetrics.errorRate.toFixed(2)} errors per 100 words`);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 Test data generation complete!');
    console.log(`📊 Created ${sampleDocuments.length} documents with quality progression:`);
    sampleDocuments.forEach((doc, i) => {
      const errorRate = (doc.errors / doc.content.split(/\s+/).length) * 100;
      console.log(`   ${i + 1}. "${doc.title}": ${errorRate.toFixed(2)} errors/100 words`);
    });
    
    // Show expected trend
    const firstHalf = sampleDocuments.slice(0, 2);
    const secondHalf = sampleDocuments.slice(2);
    const firstAvg = firstHalf.reduce((sum, doc) => sum + (doc.errors / doc.content.split(/\s+/).length) * 100, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, doc) => sum + (doc.errors / doc.content.split(/\s+/).length) * 100, 0) / secondHalf.length;
    
    console.log(`📈 Expected trend: ${firstAvg.toFixed(2)} → ${secondAvg.toFixed(2)} (${secondAvg < firstAvg ? 'IMPROVING' : 'DECLINING'} ↗️)`);
    
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  }
}

// Function to clear test data
export async function clearTestProgressData(userId: string): Promise<void> {
  console.log('🧹 Clearing test progress data...');
  
  try {
    // Get all user documents
    const documents = await documentService.getUserDocuments(userId);
    
    // Delete documents that match our test titles
    const testTitles = sampleDocuments.map(doc => doc.title);
    
    for (const doc of documents) {
      if (testTitles.includes(doc.title)) {
        await documentService.deleteDocument(doc.id, userId);
        console.log(`🗑️ Deleted test document: "${doc.title}"`);
      }
    }
    
    console.log('✅ Test data cleared!');
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    throw error;
  }
} 