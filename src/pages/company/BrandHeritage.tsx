import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBrandHeritageImageUrl } from '../../utils/supabase/storage';
import { supabase } from '../../utils/supabase/client';

export function BrandHeritage() {
  const [sectionData, setSectionData] = useState({
    title: 'Our Heritage',
    subtitle: 'Crafting Excellence Since 1847',
    description: 'For over two centuries, our master craftsmen have perfected the art of tobacco curation, selecting only the finest leaves from the most prestigious plantations around the world.',
    backgroundImage: getBrandHeritageImageUrl('DSC07229_FULL_1.webp'),
    buttonText: 'Learn More',
    buttonUrl: '/about'
  });

  useEffect(() => {
    loadSectionData();
  }, []);

  const loadSectionData = async () => {
    try {
      const { data, error } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'brand_heritage')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading brand heritage data:', error);
        return;
      }

      if (data) {
        setSectionData({
          title: data.title || 'Our Heritage',
          subtitle: data.subtitle || 'Crafting Excellence Since 1847',
          description: data.description || 'For over two centuries, our master craftsmen have perfected the art of tobacco curation, selecting only the finest leaves from the most prestigious plantations around the world.',
          backgroundImage: data.background_image ? getBrandHeritageImageUrl(data.background_image) : getBrandHeritageImageUrl('DSC07229_FULL_1.webp'),
          buttonText: data.button_text || 'Learn More',
          buttonUrl: data.button_url || '/about'
        });
      }
    } catch (error) {
      console.error('Error loading brand heritage data:', error);
    }
  };

  return (
    <section className="py-16 bg-creme min-h-screen flex items-center">
      <div className="w-full max-w-none px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div>
              <div className="suptitle text-canyon mb-6">{sectionData.title}</div>
              <h2 className="medium-title text-dark mb-8">
                {sectionData.subtitle}
              </h2>
              <div className="w-16 h-1 bg-canyon mb-8"></div>
            </div>

            <div className="space-y-6 text text-dark/80 leading-relaxed">
              <p className="text-lg text-dark">
                {sectionData.description}
              </p>
              
              <p>
                Each blend in our collection represents a culmination of traditional techniques passed down 
                through generations, combined with innovative aging processes that enhance the natural 
                complexity and depth of flavor.
              </p>

              <p>
                From the sun-drenched fields of Virginia to the volcanic soils of Cuba, we source our tobacco 
                from regions where climate, soil, and expertise converge to create something truly exceptional.
              </p>
            </div>

            {/* Heritage Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-dark/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif text-4xl text-canyon mb-2 group-hover:scale-110 transition-transform duration-300">1847</div>
                <div className="text-sm text-dark/70 uppercase tracking-wider font-medium">Est. Founded</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif text-4xl text-canyon mb-2 group-hover:scale-110 transition-transform duration-300">15</div>
                <div className="text-sm text-dark/70 uppercase tracking-wider font-medium">Master Blenders</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif text-4xl text-canyon mb-2 group-hover:scale-110 transition-transform duration-300">47</div>
                <div className="text-sm text-dark/70 uppercase tracking-wider font-medium">Premium Blends</div>
              </motion.div>
            </div>

            <div className="pt-8">
              <a href={sectionData.buttonUrl} className="btn-primary inline-flex items-center">
                {sectionData.buttonText}
              </a>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative group">
              <img 
                src={sectionData.backgroundImage} 
                alt="Tobacco craftsmanship"
                className="w-full aspect-[4/5] object-cover rounded-lg group-hover:scale-105 transition-transform duration-700"
              />
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-20 h-20 border-l-2 border-t-2 border-canyon opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute -bottom-4 -right-4 w-20 h-20 border-r-2 border-b-2 border-canyon opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>

            {/* Quote overlay */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="absolute -bottom-8 -left-8 glass-card p-6 shadow-lg max-w-xs border border-dark/20 rounded-lg bg-creme-light/95 backdrop-blur-sm"
            >
              <blockquote className="font-serif text-dark italic text-lg leading-relaxed">
                "Excellence is never an accident. It is the result of dedication, sincere effort, and skilled execution."
              </blockquote>
              <cite className="text-sm text-dark/70 mt-2 block font-medium">
                — Master Craftsman, 1892
              </cite>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
