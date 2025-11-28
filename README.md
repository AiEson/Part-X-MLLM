# Part-X-MLLM: Part-aware 3D Multimodal Large Language Model

<div align="center">
<p align="center">
    Paper: <a href="https://arxiv.org/abs/2511.13647"><img src='https://img.shields.io/badge/arXiv-2511.13647-b31b1b.svg' alt='arXiv'></a> &emsp;
    Project Page: <a href='https://chunshi.wang/Part-X-MLLM/'>Part-X-MLLM</a>
</p>
    <a href="https://chunshi.wang/" target="_blank">Chunshi Wang</a><sup>†1,2</sup>,
    <a href="https://jamesyjl.github.io/" target="_blank">Junliang Ye</a><sup>†,‡,3,2</sup>,
    <a href="https://yhyang-myron.github.io/" target="_blank">Yunhan Yang</a><sup>†,4,2</sup>,
    <a href="https://yang-l1.github.io/" target="_blank">Yang Li</a><sup>2</sup>,
    Zizhuo Lin<sup>1</sup>,
    <a href="https://ml.cs.tsinghua.edu.cn/~jun/" target="_blank">Jun Zhu</a><sup>3</sup>,
    Zhuo Chen<sup>2</sup>,
    <a href="https://scholar.google.com/citations?user=pnVwaGsAAAAJ" target="_blank">Yawei Luo</a><sup>✉,1</sup>,
    Chunchao Guo<sup>✉,2</sup>
</div>
<div align="center">
    <sup>1</sup>Zhejiang University&emsp; <sup>2</sup>Tencent Hunyuan&emsp; <sup>3</sup>Tsinghua University&emsp; <sup>4</sup>The University of Hong Kong
</div>
<div align="center">
    <sup>†</sup>Equal Contribution&emsp; <sup>‡</sup>Project Lead&emsp; <sup>✉</sup>Corresponding Author
</div>

---

![overview](assets/pipeline.png)

## Abstract
We introduce Part-X-MLLM, a native 3D multimodal large language model that unifies diverse 3D tasks by formulating them as programs in a structured, executable grammar. Given an RGB point cloud and a natural language prompt, our model autoregressively generates a single, coherent token sequence encoding part-level bounding boxes, semantic descriptions, and edit commands. This structured output serves as a versatile interface to drive downstream geometry-aware modules for part-based generation and editing. By decoupling the symbolic planning from the geometric synthesis, our approach allows any compatible geometry engine to be controlled through a single, language-native frontend. We pre-train a dual-encoder architecture to disentangle structure from semantics and instruction-tune the model on a large-scale, part-centric dataset. Experiments demonstrate that our model excels at producing high-quality, structured plans, enabling state-of-the-art performance in grounded Q&A, compositional generation, and localized editing through one unified interface.

## Citation

```bibtex
@misc{wang2025partxmllmpartaware3dmultimodal,
      title={Part-X-MLLM: Part-aware 3D Multimodal Large Language Model}, 
      author={Chunshi Wang and Junliang Ye and Yunhan Yang and Yang Li and Zizhuo Lin and Jun Zhu and Zhuo Chen and Yawei Luo and Chunchao Guo},
      year={2025},
      eprint={2511.13647},
      archivePrefix={arXiv},
      primaryClass={cs.CV},
      url={https://arxiv.org/abs/2511.13647}, 
}
```
